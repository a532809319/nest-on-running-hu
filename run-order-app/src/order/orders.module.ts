import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './order.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
// import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
// import { ModuleRef } from '@nestjs/core';


@Module({
  imports: [
  
    TypeOrmModule.forFeature([Order]),

        
              ClientsModule.register([
              {
                name: 'INVENTORY_SERVICE',
                transport: Transport.RMQ,
                options: {
                  urls: ['amqp://localhost:5672'],
                  queue: 'inventory_queue',
                  queueOptions: {
                    durable: true
                  }
                }
              }
            ])

      //  BullModule.registerQueueAsync({
      //   imports: [ConfigModule],
      //   useFactory: async (configService: ConfigService) => ({
      //     redis: {
      //       host: configService.get('REDIS_HOST'),
      //       port: configService.get('REDIS_PORT'),
      //       name: 'order_timeout',

      //     },
      //   }),
      //   inject: [ConfigService],
        
      // }),
    
   
  


   
   ]
   ,
  controllers: [OrdersController],
  providers: [OrdersService],
    exports: [OrdersService]
  
})
export class OrdersModule {}