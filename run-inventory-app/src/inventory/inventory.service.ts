import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InitializeStockDto } from './dto/initialize-stock.dto';
import { ClientProxy } from '@nestjs/microservices';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs';
import { error } from 'console';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly REDIS_PRODUCT_STOCK_PREFIX = 'product:stock:'; // Redis 缓存键前缀
  private myFileContent: string; // Lua 脚本内容

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource, // 注入 DataSource 用于手动管理事务
    @Inject('ORDER_SERVICE') private readonly orderServiceClient: ClientProxy, // 订单服务客户端
    @Inject('REDIS_INSTANCE') private readonly redisClient: Redis, // Redis 客户端实例
  ) {
    this.loadLuaScript();
  }

  private loadLuaScript() {
    // 构建文件路径
    // process.cwd() 返回 Node.js 进程的当前工作目录，通常是项目的根目录
    const fileName = 'src/lua/decrease_stock.lua'; // 你的文件名
    const filePath = path.join(process.cwd(), fileName);
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        this.logger.error(`File not found at path: ${filePath}`);
        // 可以选择抛出错误或者进行其他错误处理
        throw new Error(`Required file ${fileName} not found.`);
      }

      // 使用 fs.readFileSync 同步读取文件内容
      // 对于小型配置文件或脚本是可接受的
      this.myFileContent = fs.readFileSync(filePath, 'utf8');
      this.logger.log(`Successfully loaded file from: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to load file ${fileName}: ${error.message}`);
      // 生产环境应有更完善的错误处理
    }
  }

  /**
   * 查询商品库存（优先从 Redis 缓存获取）
   * @param productId 商品ID
   * @returns Product 商品信息
   */
  async getProductStock(productId: number): Promise<any> {
    const cacheKey = `${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`;
    try {
      // 1. 尝试从 Redis 缓存获取
      const cachedProduct = await this.redisClient.get(cacheKey);
      console.log("缓存库存", cachedProduct)

      if (cachedProduct&& parseInt(cachedProduct) > 0) {
        this.logger.debug(`Cache hit for product ${productId}++++cachedProduct库存:${cachedProduct}`);
        return cachedProduct;
      } else {
        // 2. 缓存未命中，从数据库查询
        const product = await this.productRepository.findOne({ where: { id: productId } });
          if(product&&product.stock==0){
            return 0
          }
         console.log("数据库库存",product)

        if (product&&product.stock>0) {
          // 3. 将查询结果存入 Redis 缓存，并设置过期时间（例如1小时）
          await this.redisClient.set(cacheKey, JSON.stringify(product.stock), 'EX', 3600);
          this.logger.debug(`Cache miss, fetched from DB for product ${productId}`);
          return product.stock;

        } else {
          return 0;

        }
      }


    } catch (error) {
      this.logger.error(`Error getting product stock from cache or DB for product ${productId}: ${error.message}`);
      // 发生错误时，回退到只从数据库查询
      return { 'msg': '缓存没有 或者代码出错' };
    }
  }

  /**
   * **悲观锁方式扣减库存**
   * 使用 MySQL 的 `SELECT ... FOR UPDATE` 实现行级锁，在事务中确保数据一致性。
   * 并发性能相对较低，但数据一致性最强。
   * @param data UpdateStockDto
   * @returns boolean 扣减是否成功
   */
  async decreaseStockPessimisticLock(data: UpdateStockDto): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(); // 开始事务

    try {
      const { productId, quantity } = data;

      // **悲观锁：SELECT ... FOR UPDATE 锁定当前行**
      const product = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write_or_fail') // 应用悲观锁
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        this.logger.warn(`Product not found with ID: ${productId}`);
        await queryRunner.rollbackTransaction();
        return false;
      }

      if (product.stock < quantity) {
        this.logger.warn(`Insufficient stock for product ${productId}. Available: ${product.stock}, Ordered: ${quantity}`);
        await queryRunner.rollbackTransaction(); // 库存不足，回滚事务
        return false;
      }

      product.stock -= quantity;
      await queryRunner.manager.save(product); // 更新库存

      // 清除 Redis 缓存，确保数据一致性
      await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`);
      this.logger.log(`Stock decreased for product ${productId} by ${quantity} using pessimistic lock. New stock: ${product.stock}`);

      await queryRunner.commitTransaction(); // 提交事务
      return true;
    } catch (error) {
      this.logger.error(`Failed to decrease stock with pessimistic lock for product ${data.productId}: ${error.message}`);
      await queryRunner.rollbackTransaction(); // 发生异常，回滚事务
      return false;
    } finally {
      await queryRunner.release(); // 释放 QueryRunner
    }
  }

  /**
   * **乐观锁方式扣减库存**
   * 利用数据库的版本号字段 (`version`)，在更新时检查版本是否一致。
   * 如果版本不一致，表示数据已被其他事务修改，当前操作需重试。
   * 适用于读多写少，冲突不频繁的场景。
   * @param data UpdateStockDto
   * @returns boolean 扣减是否成功
   */
  async decreaseStockOptimisticLock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;

    // 尝试多次，处理乐观锁冲突，提高成功率
    for (let i = 0; i < 3; i++) { // 比如最多尝试3次
      const product = await this.productRepository.findOne({ where: { id: productId } });

      if (!product) {
        this.logger.warn(`Product not found with ID: ${productId}`);
        return false;
      }

      if (product.stock < quantity) {
        this.logger.warn(`Insufficient stock for product ${productId}. Available: ${product.stock}, Ordered: ${quantity}`);
        return false;
      }

      const newStock = product.stock - quantity;
      // **乐观锁：更新时检查版本号是否与读取时一致，并更新版本号**
      const result = await this.productRepository.update(
        { id: productId, version: product.version }, // 条件：ID和旧版本号
        { stock: newStock, version: product.version + 1 }, // 更新：新库存和新版本号
      );

      if (result.affected && result.affected > 0) { // 如果 affected > 0，表示更新成功
        // 清除 Redis 缓存
        await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`);
        this.logger.log(`Stock decreased for product ${productId} by ${quantity} using optimistic lock. New stock: ${newStock}`);
        return true; // 更新成功，退出循环
      } else {
        this.logger.warn(`Optimistic lock conflict for product ${productId}. Retrying... (Attempt ${i + 1})`);
        // 发生冲突，重试
      }
    }
    this.logger.error(`Failed to decrease stock for product ${productId} after multiple optimistic lock retries.`);
    return false; // 达到最大重试次数仍失败
  }

  /**
   * **Redis Lua 原子操作扣减库存**
   * 使用 Redis Lua 脚本保证库存检查和扣减的原子性，避免竞态条件。
   * 适用于大量并发场景，性能高。
   * Redis 内存操作，速度快。但需要额外考虑数据库同步。
   * @param data UpdateStockDto
   * @returns boolean 扣减是否成功
   */
  async decreaseStockByLua(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    const stockKey = `${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`;

    // 确保 Redis 中有库存数据，否则从数据库加载并缓存
    // 这里是为了防止Redis缓存中没有这个商品数据时，Lua脚本无法获取到当前库存
    const cachedStock = await this.redisClient.get(stockKey);
    if (cachedStock === null) { // 只有当缓存中完全没有该key时才从DB加载
      const product = await this.productRepository.findOne({ where: { id: productId } });
      if (product && product.stock.toString()) {
        await this.redisClient.set(stockKey, product.stock.toString(), 'EX', 3600); // 设置过期时间
        this.logger.debug(`Loaded stock for product ${productId} into Redis: ${product.stock}`);
      } else {
        this.logger.warn(`Product not found in DB for ID: ${productId}, cannot perform Lua decrement.`);
        return false; // 商品不存在
      }
    }
    // 执行 Lua 脚本： KEYS[1] 是 stockKey, ARGV[1] 是 quantity
    const result = await this.redisClient.eval(this.myFileContent, 1, stockKey, quantity);
    console.log("resultstockKey", result, stockKey, quantity)
    console.log("result lua", result)
    console.log("result lua", result)
    if (result === 1) { // 脚本返回 1 表示成功
      this.logger.log(`Stock decreased for product ${productId} by ${quantity} using Lua script.`);
      // **重要：异步更新数据库以保持最终一致性。**
      // 在高并发下，此处不立即同步数据库，而是使用后台任务、消息队列或定时任务异步更新。
      // 为简化示例，这里直接更新数据库，但在极端高并发下可能导致DB成为瓶颈，或Redis与DB短暂不一致。
      // TypeORM 的 decrement 方法是原子操作，因为它生成的是 SQL DECREMENT。
      await this.productRepository.decrement({ id: productId }, 'stock', quantity);
      return true;
    } else { // 脚本返回 0 表示库存不足
      this.logger.warn(`Insufficient stock for product ${productId} using Lua script.`);
      return false;
    }
  }

  /**
   * 增加库存 (用于库存回滚或员工手动添加)
   * 使用悲观锁确保原子性。
   * @param data UpdateStockDto
   * @returns Promise<boolean>
   */
  async increaseStock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // setLock(lockMode: "pessimistic_read" | "pessimistic_write" | "dirty_read" | "pessimistic_partial_write" | "pessimistic_write_or_fail" | "for_no_key_update" | "for_key_share", lockVersion?: undefined, lockTables?: string[]): this;

      const product = await queryRunner.manager

        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_read') // 悲观锁防止并发问题
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        this.logger.warn(`Product not found for stock increase with ID: ${productId}`);
        await queryRunner.rollbackTransaction();
        return false;
      }

      product.stock += quantity;
      await queryRunner.manager.save(product);

      // 清除 Redis 缓存
      await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`);
      this.logger.log(`Stock increased for product ${productId} by ${quantity}. New stock: ${product.stock}`);

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      this.logger.error(`Failed to increase stock for product ${productId}: ${error.message}`);
      await queryRunner.rollbackTransaction();
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 初始化或设置商品库存。
   * 如果商品存在，则更新其库存；如果商品不存在，则创建新商品并设置库存。
   * @param data InitializeStockDto
   * @returns Product 被初始化或更新的商品
   */
  async initializeProductStock(data: InitializeStockDto): Promise<Product> {
    const { productId, initialStock, productName, productPrice } = data;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let product = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (product) {
        product.stock = initialStock;
        this.logger.log(`Updating stock for existing product ${productId} to ${initialStock}.`);
      } else {
        if (!productName || productPrice === undefined || productPrice === null) {
          throw new HttpException('Product name and price are required to initialize a new product.', HttpStatus.BAD_REQUEST);
        }
        product = this.productRepository.create({
          id: productId,
          name: productName,
          stock: initialStock,
          price: productPrice,
          version: 1,
        });
        this.logger.log(`Creating new product ${productId} with initial stock ${initialStock}.`);
      }

      const savedProduct = await queryRunner.manager.save(product);

      // 清除 Redis 缓存
      await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`);
      this.logger.log(`Product ${productId} stock initialized to ${initialStock}. Redis cache cleared.`);
      // ... 在 initializeProductStock 方法的 try 块内部 ...

      // **关键：更新纯数字库存缓存**
      await this.redisClient.set(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`, savedProduct.stock.toString(), 'EX', 3600);
      this.logger.log(`Updated pure stock cache for ${productId} to ${savedProduct.stock}.`);
      await queryRunner.commitTransaction();
      return savedProduct;
    } catch (error) {
      this.logger.error(`Failed to initialize stock for product ${productId}: ${error.message}`);
      await queryRunner.rollbackTransaction();
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release();
    }
  }
}