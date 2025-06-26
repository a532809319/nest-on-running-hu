import { Injectable, Inject } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis'; // 导入 ioredis 类型
import { REDIS_CLUSTER_CLIENT } from './redis/redis.module'; // 导入我们定义的 Injection Token

@Injectable()
export class AppService {
  constructor(
    // 使用 @Inject() 装饰器和 REDIS_CLUSTER_CLIENT token 来注入 Redis Cluster 客户端实例
    @Inject(REDIS_CLUSTER_CLIENT) private readonly redisClusterClient: Cluster,
  ) {}

  /**
   * 演示：在 Redis 集群中设置和获取一个简单的键值对
   * @returns 存储和获取到的字符串
   */
  async getHello(): Promise<string> {
    const key = 'nest:hello:message';
    const value = `你好，来自 NestJS Redis 集群！当前时间：${new Date().toLocaleString()}`;

    // 使用 Redis Cluster 客户端进行操作，ioredis 会自动处理集群的哈希槽和重定向
    await this.redisClusterClient.set(key, value, 'EX', 60); // 设置键值对，60 秒过期
    const storedValue = await this.redisClusterClient.get(key);

    return `成功存储并从 Redis 集群获取到数据："${storedValue}"`;
  }

  /**
   * 缓存 JSON 对象到 Redis
   * @param cacheKey 缓存键名
   * @param dataToCache 要缓存的 JavaScript 对象
   * @param ttlSeconds 缓存过期时间（秒），默认为 3600 秒（1小时）
   */
  async cacheObject<T>(cacheKey: string, dataToCache: T, ttlSeconds: number = 3600): Promise<void> {
    await this.redisClusterClient.set(cacheKey, JSON.stringify(dataToCache), 'EX', ttlSeconds);
    console.log(`数据已缓存到 Redis 集群：${cacheKey}`);
  }

  /**
   * 从 Redis 获取缓存的 JSON 对象
   * @param cacheKey 缓存键名
   * @returns 缓存的 JavaScript 对象或 null
   */
  async getCachedObject<T>(cacheKey: string): Promise<T | null> {
    const jsonData = await this.redisClusterClient.get(cacheKey);
    if (jsonData) {
      console.log(`从 Redis 集群获取到缓存数据：${cacheKey}`);
      return JSON.parse(jsonData) as T;
    }
    console.log(`Redis 集群中未找到缓存数据：${cacheKey}`);
    return null;
  }
}