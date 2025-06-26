import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis'; // 导入 ioredis 类型
import { REDIS_CLUSTER_CLIENT } from './redis.module'; // 导入 Redis 客户端的注入 token

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    // 注入 Redis 集群客户端实例
    @Inject(REDIS_CLUSTER_CLIENT) private readonly redisClient: Cluster,
  ) {}

  /**
   * 设置一个键值对到 Redis
   * @param key 键名
   * @param value 键值
   * @param ttlSeconds 过期时间（秒），可选。如果为 null 或 undefined，则永不过期。
   */
  async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<string | null> {
    if (ttlSeconds) {
      // 'EX' 表示过期时间单位为秒
      return this.redisClient.set(key, value, 'EX', ttlSeconds);
    }
    return this.redisClient.set(key, value);
  }

  /**
   * 从 Redis 获取键值
   * @param key 键名
   * @returns 键值（字符串）或 null
   */
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  /**
   * 删除 Redis 中的一个或多个键
   * @param keys 一个或多个键名
   * @returns 被删除的键的数量
   */
  async del(...keys: string[]): Promise<number> {
    return this.redisClient.del(...keys);
  }

  /**
   * 检查 Redis 中是否存在某个键
   * @param key 键名
   * @returns 如果键存在返回 1，否则返回 0
   */
  async exists(key: string): Promise<number> {
    return this.redisClient.exists(key);
  }

  /**
   * 设置一个哈希表的字段
   * @param key 哈希表键名
   * @param field 字段名
   * @param value 字段值
   * @returns 1 如果是新字段，0 如果是旧字段
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redisClient.hset(key, field, value);
  }

  /**
   * 获取哈希表中的一个字段值
   * @param key 哈希表键名
   * @param field 字段名
   * @returns 字段值或 null
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.redisClient.hget(key, field);
  }

  /**
   * 获取哈希表中所有字段和值
   * @param key 哈希表键名
   * @returns 包含所有字段和值的对象
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redisClient.hgetall(key);
  }

  /**
   * 将一个或多个成员添加到有序集合
   * @param key 有序集合键名
   * @param score 成员分数
   * @param member 成员值
   * @returns 新添加的成员数量
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.redisClient.zadd(key, score, member);
  }

  /**
   * 获取有序集合中指定范围的成员
   * @param key 有序集合键名
   * @param start 起始索引
   * @param stop 结束索引
   * @returns 成员数组
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redisClient.zrange(key, start, stop);
  }

  /**
   * 执行 Redis 事务 (MULTI/EXEC)
   * @param commands 包含 [command, args...] 的命令数组
   * @returns 事务执行结果的数组
   */
  // async multi(commands: (string | number)[][]): Promise<(string | number)[]> {
  //   const multi = this.redisClient.multi(commands);
  //   return multi.exec();
  // }

  /**
   * 获取底层的 ioredis 客户端实例，如果需要直接操作
   * @returns ioredis 的 Redis.Cluster 实例
   */
  getClient(): Cluster {
    return this.redisClient;
  }

  /**
   * 在模块销毁时关闭 Redis 连接，防止内存泄漏
   * NestJS 生命周期钩子
   */
  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.status === 'ready') {
      console.log('🔗 关闭 Redis 集群连接...');
      await this.redisClient.quit(); // 使用 quit() 优雅地关闭连接
      console.log('🔗 Redis 集群连接已关闭。');
    }
  }
}