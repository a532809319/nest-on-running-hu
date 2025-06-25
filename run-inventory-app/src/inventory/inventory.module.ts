// inventory-service/src/inventory/inventory.module.ts
import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from 'src/redis/redis.module';
// import Redis from 'ioredis'; // No need to import Redis here if it's provided by RedisModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    ClientsModule.registerAsync([
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
             urls: ['amqp://localhost:5672'],
            queue: 'order_queue',
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
    RedisModule, // <-- Import the module that exports 'REDIS_INSTANCE'
  ],
  providers: [
    InventoryService,
    // No need to define 'REDIS_INSTANCE' here again, as it's provided and exported by RedisModule
    // and imported above.
  ],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}