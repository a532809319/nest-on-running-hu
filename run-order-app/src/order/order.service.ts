import {
  Injectable,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from 'src/redis/redis.service';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';
import { OrderRepository } from './order.repository';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly rabbitmqService: RabbitMQService,
    @InjectDataSource()
    private dataSource: DataSource,
    private orderRepo: OrderRepository
  ) { }
  private async preDeductStock(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    const key = `stock:${productId}`;

    const script = `
      local key = KEYS[1]
      local deduct = tonumber(ARGV[1])
      local stock = tonumber(redis.call('GET', key))
      
      if not stock then 
        return redis.error_reply('产品未初始化')
      end
      
      if stock < deduct then
        return 0
      end
      
      redis.call('DECRBY', key, deduct)
      return 1
    `;

    try {

      const result = await this.redisService.eval(
        script,
        [key],
        [String(quantity)]
      );

      return result === 1 || result == 0;
    } catch (e) {
      console.error('Redis库存操作失败来了: 要发生事故了', e);
      return false;
    }
  }


  async createOrder(
    productId: string,
    productName: string,
    quantity: number,
    userId: string
  ) {
      const rdisStocks = await this.redisService.get(`stock:${productId}`);

        if (rdisStocks == 0 || rdisStocks == 1) {
            throw new BadRequestException('库存不足0');
          }
    // 开启事务

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
      // console.log("rdisStocks:====", rdisStocks)

    try {
      // 1. Redis预扣库存
  
      const preDeductSuccess = await this.preDeductStock(productId, quantity);
      // console.log("preDeductSuccess:====", !preDeductSuccess)
      if (!preDeductSuccess) {
        console.log(preDeductSuccess,"jinnn")
        throw new BadRequestException('库存不足');
      }
    
      // 2. 生成订单ID
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      // 3. 创建待确认订单
      const order = await this.orderRepo.createPendingOrder(
        orderId,
        productId,
        productName,
        quantity,
        userId
      );

      // 4. 获取库存版本 暂时不要
      // const version: any = await this.getStockVersion(productId);

      // 5. 发送库存扣减消息到队列
      await this.rabbitmqService.publish('stock_deduction', {
        productId,
        quantity,
        // version: parseInt(version || '1', 10),
        userId,
        orderId
      });

      // 提交事务
      await queryRunner.commitTransaction();

      return {
        status: 'created',
        orderId: order.orderId,
        timestamp: new Date()
      };
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();

      // 回滚Redis库存
      await this.redisService.incrby(`stock:${productId}`, quantity);

      this.logger.error(`创建订单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建订单失败: ${error.message}`);
    } finally {
      // 释放连接
      await queryRunner.release();
    }
  }

  // ... 其他方法保持不变 ...

  private async getStockVersion(productId: string): Promise<number> {
    const version = await this.redisService.get(`stock_version:${productId}`);
    return parseInt(version || '1', 10);
  }
}