import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    ClientsModule.registerAsync([
      {
        name: 'ORDER_SERVICE', // 用于向订单服务发送消息 (如库存回滚)
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
         urls: [process.env.NODE_ENV=='production'?'amqp://rabbitmq:5672':'amqp://localhost:5672'],
            queue: 'order_queue', // 订单服务的队列名称
            queueOptions: {
              durable: false,
            },
          },
        }),
      },
    ]),
  ],
  providers: [
    InventoryService,
    {
      provide: 'REDIS_INSTANCE', // 提供 ioredis 客户端实例
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('app.redis.host'),
          port: configService.get<number>('app.redis.port'),
        });
      },
      inject: [ConfigService],
    },
  ],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}