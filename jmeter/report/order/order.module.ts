import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { RedisModule } from 'src/redis/redis.module';
import { Order } from './entities/order.entity';
import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';
import { OrderRepository } from './order.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    RabbitMQModule,
    RedisModule,
  ],
  controllers: [OrderController],
  providers: [OrderService,OrderRepository],
    exports: [OrderService]
  
})
export class OrderModule {}