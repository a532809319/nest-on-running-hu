// order-service/src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, BullModuleOptions } from '@nestjs/bull'; // Import BullModuleOptions
import { OrdersService } from './order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('app.rabbitmq.url')!],
            queue: 'inventory_queue',
            queueOptions: {
              durable: false,
            },
          },
        }),
      },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const clusterNodes = configService.get<Array<{ host: string; port: number }>>(
          'app.redis.clusterNodes',
        )!; // Non-null assertion as discussed

        const clusterOptions = configService.get<any>('app.redis.clusterOptions');

        // This is the key change:
        // BullModule's 'redis' property expects an IORedis.RedisOptions object,
        // or a simpler object with 'host'/'port', or directly 'nodes' for cluster.
        // For cluster, you pass the nodes directly in the 'redis' object,
        // and any other ioredis cluster options go alongside.
        const bullRedisConfig: BullModuleOptions['redis'] = {
          // You can directly pass the Ioredis ClusterNode objects here
          // The type of `nodes` in Bull's RedisOpts is `(string | Redis.ClusterNode)[]`
          nodes: clusterNodes.map(node => ({
            host: node.host,
            port: node.port,
          })),
          // Any other Ioredis options (like password, db, connectTimeout)
          // go directly into this object, not nested under an 'options' property.
          connectTimeout: 10000,
          // If you have other Ioredis options from clusterOptions.redisOptions, spread them here:
          ...(clusterOptions.redisOptions || {}), // Ensure it's an object, even if clusterOptions.redisOptions is undefined
        };

        return {
          redis: bullRedisConfig,
          // Other BullModule options like prefix, defaultJobOptions etc. go here
          // prefix: '{bull}', // Recommended for cluster, ensures all Bull keys stay in one slot
        };
      },
    }),
    BullModule.registerQueue({
      name: 'order_timeout',
      // If you want this specific queue to use a different Redis config, you'd specify it here:
      // redis: { ... },
    }),
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}