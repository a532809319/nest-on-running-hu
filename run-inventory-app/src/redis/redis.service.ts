import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient) {}

  async set(key: string, value: any) {
    return this.redisClient.set(key, value);
  }

  async get(key: string) {
    return this.redisClient.get(key);
  }

  async incrby(key: string, value: number) {
    return this.redisClient.incrBy(key, value);
  }

  async decrby(key: string, value: number) {
    return this.redisClient.decrBy(key, value);
  }

  async eval(script: string, keys: string[], args: any[]) {
    return this.redisClient.eval(script, { keys, arguments: args });
  }
}