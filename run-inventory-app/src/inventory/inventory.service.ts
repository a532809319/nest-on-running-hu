// inventory-service/src/inventory/inventory.service.ts
import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { UpdateStockDto } from './dto/update-stock.dto';
import Redis from 'ioredis'; // 导入 ioredis
import * as path from 'path';
import * as fs from 'fs';
import { InitializeStockDto } from './dto/initialize-stock.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly REDIS_PRODUCT_STOCK_PREFIX = 'product:stock:'; // Redis 缓存键前缀
  private stockLuaScript: string; // Lua 脚本

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource, // 注入 DataSource 用于手动管理事务
      @Inject('ORDER_SERVICE') private readonly orderServiceClient: ClientProxy, // 注入订单服务客户端
    @Inject('REDIS_INSTANCE') private readonly redisClient: Redis, // 注入 Redis 实例

  ) {
    // 加载 Lua 脚本
    this.loadLuaScript();
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
    await queryRunner.startTransaction(); // 开始事务

    try {
      // 悲观锁：锁定行，防止其他操作同时修改
      let product = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock("pessimistic_read")
        .where('product.id = :id', { id: productId })
        .getOne();

      if (product) {
        // 商品已存在，更新库存
        product.stock = initialStock;
        this.logger.log(`Updating stock for existing product ${productId} to ${initialStock}.`);
      } else {
        // 商品不存在，创建新商品
        if (!productName || productPrice === undefined || productPrice === null) {
          throw new HttpException('Product name and price are required to initialize a new product.', HttpStatus.BAD_REQUEST);
        }
        product = this.productRepository.create({
          id: productId, // 可以指定ID，或者让数据库自增
          name: productName,
          stock: initialStock,
          price: productPrice,
          version: 1, // 新商品版本号从1开始
        });
        this.logger.log(`Creating new product ${productId} with initial stock ${initialStock}.`);
      }

      const savedProduct = await queryRunner.manager.save(product);

      // 清除 Redis 缓存，确保数据一致性
      await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`);
      this.logger.log(`Product ${productId} stock initialized to ${initialStock}. Redis cache cleared.`);

      await queryRunner.commitTransaction(); // 提交事务
      return savedProduct;
    } catch (error) {
      this.logger.error(`Failed to initialize stock for product ${productId}: ${error.message}`);
      await queryRunner.rollbackTransaction(); // 发生异常，回滚事务
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release(); // 释放 QueryRunner
    }
  }

  // 加载 Lua 脚本
  private loadLuaScript() {
    try {
      const scriptPath = path.join(__dirname, 'lua', 'decrease_stock.lua');
      const base_path = process.env.NODE_ENV == "production" ? "dist" : "src"
    const file_path = base_path +"/inventory/lua/decrease_stock.lua"
      this.stockLuaScript = fs.readFileSync(file_path, 'utf8');
      this.logger.log('Lua script loaded successfully.');
    } catch (error) {
      this.logger.error('Failed to load Lua script:', error.message);
      // 在生产环境中，可能需要更健壮的错误处理
    }
  }

  /**
   * 查询商品库存（优先从 Redis 缓存获取）
   * @param productId 商品ID
   * @returns 商品信息
   */
  async getProductStock(productId: number): Promise<Product|null> {
    const cacheKey = `${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`;
    try {
      // 1. 尝试从 Redis 缓存获取
      const cachedProduct = await this.redisClient.get(cacheKey);
      if (cachedProduct) {
        this.logger.debug(`Cache hit for product ${productId}`);
        return JSON.parse(cachedProduct);
      }

      // 2. 缓存未命中，从数据库查询
      const product = await this.productRepository.findOne({ where: { id: productId } });
      if (product) {
        // 3. 将查询结果存入 Redis 缓存，并设置过期时间（例如1小时）
        await this.redisClient.set(cacheKey, JSON.stringify(product), 'EX', 3600);
        this.logger.debug(`Cache miss, fetched from DB for product ${productId}`);
      }
      return product ;
    } catch (error) {
      this.logger.error(`Error getting product stock from cache or DB for product ${productId}: ${error.message}`);
      // 发生错误时，回退到只从数据库查询，不影响主流程
      return this.productRepository.findOne({ where: { id: productId } }) ;
    }
  }

  /**
   * 扣减库存（悲观锁方式）
   * 使用 MySQL 的 FOR UPDATE 实现行级锁，保证并发安全。
   * @param data UpdateStockDto
   * @returns boolean 扣减是否成功
   */
  async decreaseStockPessimisticLock(data: UpdateStockDto): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(); // 开始事务

    try {
      const { productId, quantity } = data;
    // 悲观锁：SELECT ... FOR UPDATE
        // "pessimistic_read"     // 悲观读锁（共享锁）
        // "pessimistic_write"    // 悲观写锁（排他锁）
        // "for_no_key_update"    // 禁止修改锁定行（PostgreSQL 特有）
        // "for_key_share"        // 禁止修改外键（PostgreSQL 特有）
      const product = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock("pessimistic_read")
        // 应用悲观锁
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
   * 扣减库存（乐观锁方式）
   * 利用数据库的版本号字段，在更新时检查版本是否一致。
   * @param data UpdateStockDto
   * @returns boolean 扣减是否成功
   */
  async decreaseStockOptimisticLock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;

    // 尝试多次，处理乐观锁冲突
    for (let i = 0; i < 3; i++) { // 比如尝试3次
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
      // 乐观锁：更新时检查版本号
      const result = await this.productRepository.update(
        { id: productId, version: product.version }, // 条件：ID和旧版本号
        { stock: newStock, version: product.version + 1 }, // 更新：新库存和新版本号
      );

      if (result.affected&&result.affected > 0) {
        // 清除 Redis 缓存
        await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`);
        this.logger.log(`Stock decreased for product ${productId} by ${quantity} using optimistic lock. New stock: ${newStock}`);
        return true; // 更新成功
      } else {
        this.logger.warn(`Optimistic lock conflict for product ${productId}. Retrying...`);
        // 发生冲突，重试
      }
    }
    this.logger.error(`Failed to decrease stock for product ${productId} after multiple optimistic lock retries.`);
    return false; // 达到最大重试次数仍失败
  }

  /**
   * 扣减库存（Redis Lua 原子操作）
   * 使用 Redis Lua 脚本保证库存检查和扣减的原子性，避免竞态条件。
   * 适用于大量并发场景，性能高。
   * Lua 脚本文件: `inventory-service/src/inventory/lua/decrease_stock.lua`
   * ```lua
   * local stock_key = KEYS[1]
   * local quantity = tonumber(ARGV[1])
   *
   * local current_stock = tonumber(redis.call('get', stock_key) or '0')
   *
   * if current_stock >= quantity then
   * redis.call('decrby', stock_key, quantity)
   * return 1 -- 成功
   * else
   * return 0 -- 库存不足
   * end
   * ```
   * @param data UpdateStockDto
   * @returns boolean 扣减是否成功
   */
  async decreaseStockByLua(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    const stockKey = `${this.REDIS_PRODUCT_STOCK_PREFIX}${productId}`;

    // 确保 Redis 中有库存数据，否则从数据库加载
    const cachedStock = await this.redisClient.get(stockKey);
    if (!cachedStock) {
      const product = await this.productRepository.findOne({ where: { id: productId } });
      if (product) {
        await this.redisClient.set(stockKey, product.stock.toString(), 'EX', 3600); // 设置过期时间
        this.logger.debug(`Loaded stock for product ${productId} into Redis: ${product.stock}`);
      } else {
        this.logger.warn(`Product not found in DB for ID: ${productId}`);
        return false;
      }
    }

    // 执行 Lua 脚本
    const result = await this.redisClient.eval(this.stockLuaScript, 1, stockKey, quantity);

    if (result === 1) { // 脚本返回 1 表示成功
      this.logger.log(`Stock decreased for product ${productId} by ${quantity} using Lua script.`);
      // 异步更新数据库（或者定期同步，取决于业务需求）
      // 这里为了简单，直接更新数据库，实际生产可以考虑使用MQ异步更新或定时任务
      // 注意：这里仍然可能导致 Redis 和 DB 数据不一致的短暂窗口，需要权衡
      await this.productRepository.decrement({ id: productId }, 'stock', quantity);
      return true;
    } else {
      this.logger.warn(`Insufficient stock for product ${productId} using Lua script.`);
      return false;
    }
  }

  /**
   * 增加库存（用于库存回滚）
   * @param data UpdateStockDto
   * @returns Promise<boolean>
   */
  async increaseStock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 悲观锁：SELECT ... FOR UPDATE
        // "pessimistic_read"     // 悲观读锁（共享锁）
        // "pessimistic_write"    // 悲观写锁（排他锁）
        // "for_no_key_update"    // 禁止修改锁定行（PostgreSQL 特有）
        // "for_key_share"        // 禁止修改外键（PostgreSQL 特有）
    
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
      console.log("报错了")
      this.logger.error(`cFailed to increase stock for product ${productId}: ${error.message}`);
      await queryRunner.rollbackTransaction();
      return false;
    } finally {
      await queryRunner.release();
    }
  }
}