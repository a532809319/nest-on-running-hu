import { Controller, Injectable } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext
} from '@nestjs/microservices';
import { InventoryService } from './inventory.service';
import { RedisService } from 'src/redis/redis.service';
@Controller('StockConsumer')
export class StockConsumer {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly redisService: RedisService
  ) {
  console.log(">>>>StockConsumer")
  }
  @MessagePattern('stock_deduction')
  handleMessage(data: any) {
    // 处理接收到的数据
    console.log("stock_deduction",data)
    return { msg: '收到消息', data };
  }
  @MessagePattern('stock_deduction')
  async handleStockDeduction(
    @Payload() data: any,
  ) {
     if (data.bad) {
      throw new Error('处理失败');
     }
    try {
      const { productId, quantity, version } = data;
      const success = await this.inventoryService.confirmDeductStock(
        productId,
        quantity,
        version
      );
      if (!success) {
        // Redis库存回滚
        await this.redisService.incrby(`stock:${productId}`, quantity);
        // 生产环境应通知订单服务更新订单状态
      }
    } finally {
      // channel.ack(originalMsg);
    }
  }
}