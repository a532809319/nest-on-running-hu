import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull'; // 用于订单超时队列
import { OrdersService } from './order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_SERVICE', // 用于向库存服务发送消息
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
           urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
            // urls: [configService.get<string>('app.rabbitmq.url')],
            queue: 'inventory_queue', // 库存服务的队列名称
            queueOptions: {
              durable: false,
            },
          },
        }),
      },
    ]),
    // 配置 Bull 模块，用于订单超时队列
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('app.redis.host'),
          port: configService.get<number>('app.redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'order_timeout', // 订单超时队列名称
    }),
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}