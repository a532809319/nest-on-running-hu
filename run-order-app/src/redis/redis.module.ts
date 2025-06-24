import { Module, Global } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {

        const client = createClient({
          url: process.env.NODE_ENV == 'production' ? 'redis://:@redis:6379' : 'redis://:@localhost:6379',
        });
        await client.connect();
        return client;
      }
    },
    RedisService
  ],
  exports: ['REDIS_CLIENT', RedisService]
})

export class RedisModule {}