import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InitializeStockDto } from './dto/initialize-stock.dto';
import { ClientProxy } from '@nestjs/microservices';
// ===> CHANGE THIS LINE <===
import { Redis, Cluster } from 'ioredis'; // Import Redis (class) and Cluster (class) explicitly
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  // 使用哈希标签，确保所有与特定productId相关的键落在同一个Redis槽位
  private readonly REDIS_PRODUCT_STOCK_PREFIX = 'product:stock:';
  private readonly REDIS_LOCK_PREFIX = 'product:lock:';
  private stockLuaScript: string;

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    // ===> CHANGE THIS LINE <===
        @Inject('REDIS_CLUSTER') private readonly redisClient: Cluster,

        // @Inject(REDIS_CLUSTER_CLIENT) private readonly redisClient: Cluster,

  ) {
    // this.loadLuaScript();
    // 监听 Redis Cluster 客户端事件，便于调试和监控
    this.redisClient.on('ready', () => this.logger.log('Redis Cluster client is READY.'));
    this.redisClient.on('error', (err) => this.logger.error(`Redis Cluster client ERROR: ${err.message}`));
    this.redisClient.on('reconnecting', () => this.logger.warn('Redis Cluster client is RECONNECTing...'));
    this.redisClient.on('end', () => this.logger.warn('Redis Cluster client connection ENDED.'));
  }

  private loadLuaScript() {
    try {
      const scriptPath = path.join(__dirname, 'lua', 'decrease_stock.lua');
      this.stockLuaScript = fs.readFileSync(scriptPath, 'utf8');
      this.logger.log('Lua script loaded successfully.');
    } catch (error) {
      this.logger.error('Failed to load Lua script:', error.message);
    }
  }

  /**
   * 查询商品库存（优先从 Redis 缓存获取）
   */
  async getProductStock(productId: number): Promise<any> {
    const cacheKey = `${this.REDIS_PRODUCT_STOCK_PREFIX}{${productId}}`; // 使用哈希标签
    try {
      const cachedProduct = await this.redisClient.get(cacheKey);
      if (cachedProduct) {
        this.logger.debug(`Cache hit for product ${productId}`);
        return JSON.parse(cachedProduct);
      }
      const product = await this.productRepository.findOne({ where: { id: productId } });
      if (product) {
        await this.redisClient.set(cacheKey, JSON.stringify(product), 'EX', 3600);
        this.logger.debug(`Cache miss, fetched from DB for product ${productId}`);
      }
      return product;
    } catch (error) {
      this.logger.error(`Error getting product stock from cache or DB for product ${productId}: ${error.message}`);
      // Fallback to database if Redis has issues
      return this.productRepository.findOne({ where: { id: productId } });
    }
  }

  /**
   * 增加库存 (被 HTTP 接口和 MQ 回滚消息共用)
   * 使用 MySQL 的 FOR UPDATE 实现行级锁，保证并发安全。
   * @param data UpdateStockDto
   * @returns Promise<boolean>
   */
  async increaseStock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write') // 悲观锁防止并发问题
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        this.logger.warn(`Product not found for stock increase with ID: ${productId}`);
        await queryRunner.rollbackTransaction();
        return false;
      }

      product.stock += quantity;
      await queryRunner.manager.save(product);

      // 清除 Redis 缓存，**使用哈希标签**确保数据一致性
      await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}{${productId}}`);
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
   * 扣减库存（悲观锁）
   */
  async decreaseStockPessimisticLock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const product = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write') // 悲观锁
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product || product.stock < quantity) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`Insufficient stock or product not found for ID: ${productId}. Current stock: ${product?.stock || 0}, requested: ${quantity}`);
        return false;
      }
      product.stock -= quantity;
      await queryRunner.manager.save(product);

      // 清除 Redis 缓存，**使用哈希标签**
      await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}{${productId}}`);
      this.logger.log(`Stock decreased for product ${productId} by ${quantity}. New stock: ${product.stock}`);

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      this.logger.error(`Failed to decrease stock (pessimistic lock) for product ${productId}: ${error.message}`);
      await queryRunner.rollbackTransaction();
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 扣减库存（乐观锁）
   */
  async decreaseStockOptimisticLock(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity, version } = data;
    try {
      const product = await this.productRepository.findOne({ where: { id: productId } });
      if (!product || product.stock < quantity || product.version !== version) {
        this.logger.warn(`Optimistic lock failed for product ${productId}. Possibly stale version or insufficient stock.`);
        return false;
      }
      product.stock -= quantity;
      // 如果 Product 实体有 @VersionColumn()，TypeORM 会自动增加 version 并在保存时检查乐观锁
      const result = await this.productRepository.save(product);

      if (result) {
        // 清除 Redis 缓存，**使用哈希标签**
        await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}{${productId}}`);
        this.logger.log(`Stock decreased (optimistic lock) for product ${productId} by ${quantity}.`);
        return true;
      } else {
        // 这种情况通常意味着 @VersionColumn() 检查失败，或者 save 没有实际更新
        this.logger.warn(`Optimistic lock failed for product ${productId}. Version mismatch detected.`);
        return false;
      }
    } catch (error) {
      // 捕获 TypeORM 的乐观锁冲突异常
      if (error.name === 'OptimisticLockVersionMismatchError') {
        this.logger.warn(`Optimistic lock conflict for product ${productId}: ${error.message}`);
        return false;
      }
      this.logger.error(`Failed to decrease stock (optimistic lock) for product ${productId}: ${error.message}`);
      return false;
    }
  }

  /**
   * 扣减库存（Lua 原子操作）
   */
  async decreaseStockByLua(data: UpdateStockDto): Promise<boolean> {
    const { productId, quantity } = data;
    // **核心：使用哈希标签确保 Redis 锁和缓存键在同一个槽位**
    const cacheKey = `${this.REDIS_PRODUCT_STOCK_PREFIX}{${productId}}`;
    const productLockKey = `${this.REDIS_LOCK_PREFIX}{${productId}}`;

    if (!this.stockLuaScript) {
      this.logger.error('Lua script not loaded.');
      return false;
    }

    try {
      // 尝试获取分布式锁（防止 Lua 脚本执行期间，DB 数据被直接修改）
      // 这个锁是针对特定productId的，由于使用了哈希标签，它也会落在同一个槽位
      const lockAcquired = await this.redisClient.set(productLockKey, 'locked', 'PX', 5000, 'NX'); // 5秒过期
      if (!lockAcquired) {
        this.logger.warn(`Could not acquire Redis lock for product ${productId}. Retrying later.`);
        return false; // 无法获取锁，稍后重试
      }

      let currentStock = await this.redisClient.get(cacheKey);
      if (!currentStock) {
        const productFromDb = await this.productRepository.findOne({ where: { id: productId } });
        if (!productFromDb) {
          await this.redisClient.del(productLockKey); // 释放锁
          this.logger.warn(`Product ${productId} not found in DB for Lua stock decrease.`);
          return false;
        }
        await this.redisClient.set(cacheKey, JSON.stringify(productFromDb), 'EX', 3600);
        currentStock = JSON.stringify(productFromDb); // 确保 currentStock 有值
      }

      const productObj = JSON.parse(currentStock);
      const stockBefore = productObj.stock;

      // 调用 Lua 脚本进行原子性操作 (KEYS[1]: product cache key, ARGV[1]: quantity to decrease, ARGV[2]: JSON string of product)
      const result = await (this.redisClient as any).eval(
        `-- inventory-service/src/inventory/lua/decrease_stock.lua
local stock_key = KEYS[1]
local quantity_str = ARGV[1]

-- 打印调试信息
redis.log(redis.LOG_NOTICE, "Stock Key: ", stock_key)
redis.log(redis.LOG_NOTICE, "Quantity String: " .. tostring(quantity_str)) -- 转换为字符串以打印

local quantity = tonumber(quantity_str)
redis.log(redis.LOG_NOTICE, "Parsed Quantity: " .. tostring(quantity))

if quantity == nil then
    redis.log(redis.LOG_WARNING, "Quantity is NIL. Returning 0.嘻嘻嘻")
    return 0
end

if quantity <= 0 then
    redis.log(redis.LOG_WARNING, "Quantity is <= 0. Returning 0.")
    return 0 -- 无效的扣减数量
end

local current_stock_str = redis.call('get', stock_key)
redis.log(redis.LOG_NOTICE, "xxxxRaw Current Stock String from Redis:111 " .. tostring(current_stock_str))

local current_stock = tonumber(current_stock_str)
if current_stock == nil then
    current_stock = 0
    redis.log(redis.LOG_WARNING, "Current Stock is NIL or not a number, setting to 0.")
end
redis.log(redis.LOG_NOTICE, "Final Current Stock: " .. tostring(current_stock))


if current_stock >= quantity then
    -- 库存充足，执行扣减
    redis.log(redis.LOG_NOTICE, "Stock sufficient. Decreasing " .. quantity .. " from " .. current_stock)
    redis.call('decrby', stock_key, quantity)
    return 1 -- 返回1表示成功
else
    -- 库存不足
    redis.log(redis.LOG_WARNING, "Insufficient stock. Current: " .. current_stock .. ", Needed: " .. quantity)
    return 0 -- 返回0表示失败
end`,
        1, // KEYS 数量
        cacheKey, // KEYS[1]
        quantity, // ARGV[1]
        JSON.stringify(productObj), // ARGV[2]
      );

      if (result === 0) { // Lua 脚本返回 0 表示库存不足
        this.logger.warn(`Insufficient stock for product ${productId} (Lua script). Current cached: ${stockBefore}, requested: ${quantity}`);
        return false;
      }

      // Lua 脚本执行成功，更新数据库
      const newStock = stockBefore - quantity;
      const dbUpdateResult = await this.productRepository.update(
        { id: productId },
        { stock: newStock }
      );

      if (dbUpdateResult.affected && dbUpdateResult.affected > 0) {
        this.logger.log(`Stock decreased (Lua atomic) for product ${productId} by ${quantity}. New stock: ${newStock}`);
        return true;
      } else {
        this.logger.error(`Failed to update DB after successful Lua stock decrease for product ${productId}. Manual intervention needed!`);
        // 即使 Lua 成功，DB 更新失败，可能需要回滚 Redis 或人工干预。
        // 在生产环境中，这通常需要更复杂的补偿或告警机制。
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to decrease stock (Lua atomic) for product ${productId}: ${error.message}`);
      return false;
    } finally {
      // 释放 Redis 锁
      await this.redisClient.del(productLockKey);
    }
  }

  /**
   * 初始化或设置商品库存。
   * 如果商品存在，则更新其库存；如果商品不存在，则创建新商品并设置库存。
   * 此方法包含重试机制，以应对数据库锁等待超时。
   * @param data InitializeStockDto
   * @returns Product 被初始化或更新的商品
   */
  async initializeProductStock(data: InitializeStockDto): Promise<Product> {
    const MAX_RETRIES = 3; // 最大重试次数
    const BASE_RETRY_DELAY_MS = 100; // 基础重试延迟，毫秒
    const MAX_RETRY_DELAY_MS = 2000; // 最大重试延迟

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction(); // 开始事务

      try {
        // 悲观锁：锁定行，防止其他操作同时修改
        let product = await queryRunner.manager
          .getRepository(Product)
          .createQueryBuilder('product')
          .setLock('pessimistic_write') // 悲观锁防止并发问题
          .where('product.id = :id', { id: data.productId })
          .getOne();

        if (product) {
          // 商品已存在，更新库存
          product.stock = data.initialStock;
          this.logger.log(`Attempt ${attempt}: Updating stock for existing product ${data.productId} to ${data.initialStock}.`);
        } else {
          // 商品不存在，创建新商品
          if (!data.productName || data.productPrice === undefined || data.productPrice === null) {
            throw new HttpException('Product name and price are required to initialize a new product.', HttpStatus.BAD_REQUEST);
          }
          product = this.productRepository.create({
            id: data.productId,
            name: data.productName,
            stock: data.initialStock,
            price: data.productPrice,
            version: 1, // 新商品版本号从1开始
          });
          this.logger.log(`Attempt ${attempt}: Creating new product ${data.productId} with initial stock ${data.initialStock}.`);
        }

        const savedProduct = await queryRunner.manager.save(product);

        // 清除 Redis 缓存，**使用哈希标签**确保数据一致性
        await this.redisClient.del(`${this.REDIS_PRODUCT_STOCK_PREFIX}{${data.productId}}`);
        this.logger.log(`Attempt ${attempt}: Product ${data.productId} stock initialized to ${data.initialStock}. Redis cache cleared.`);

        await queryRunner.commitTransaction(); // 提交事务
        return savedProduct; // 成功，返回结果
      } catch (error) {
        await queryRunner.rollbackTransaction(); // 发生异常，回滚事务

        // 如果是数据库锁等待超时，且未达到最大重试次数，则进行重试
        if (error.message.includes('Lock wait timeout exceeded') && attempt < MAX_RETRIES) {
          const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
          this.logger.warn(`Attempt ${attempt} failed for product ${data.productId} due to lock wait timeout. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay)); // 延迟重试
          continue; // 继续下一次尝试
        } else {
          // 如果是其他错误，或已达到最大重试次数，则抛出错误
          this.logger.error(`Failed to initialize stock for product ${data.productId} after ${attempt} attempts: ${error.message}`);
          throw new HttpException(error.message || 'Failed to initialize stock.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } finally {
        await queryRunner.release(); // 无论成功或失败，最后都释放 QueryRunner
      }
    }
    // 如果所有重试都失败，会在这里抛出最后的错误
    throw new HttpException('Failed to initialize stock after multiple retries.', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}