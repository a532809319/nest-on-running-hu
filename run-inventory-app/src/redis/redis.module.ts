// src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global() // Optional: Makes this module globally available once imported in root module
@Module({
  imports: [ConfigModule], // Need ConfigModule to get Redis host/port
  providers: [
    {
      provide: 'REDIS_INSTANCE', // Custom token for the ioredis client
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_INSTANCE'], // <-- Key step: Export the Redis provider
})
export class RedisModule {}