import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import {
  redisClusterNodes,
  redisClusterCommonOptions,
  redisClusterSpecificOptions,
} from '../config/redis.config'; // 导入配置

// 定义一个 Injection Token，这是在 NestJS 依赖注入系统中识别 Redis 客户端的唯一标识符
export const REDIS_CLUSTER_CLIENT = 'REDIS_CLUSTER_CLIENT';

@Global() // 使用 @Global() 装饰器，使这个提供者在整个应用中全局可用，无需在其他模块中再次导入 RedisModule
@Module({
  providers: [
    {
      provide: REDIS_CLUSTER_CLIENT, // 提供者标识符
      useFactory: async () => { // 使用 useFactory 来动态创建 Redis 客户端实例
        // 核心：使用 Redis.Cluster 构造函数连接 Redis 集群
        // 第一个参数是集群节点列表
        // 第二个参数是集群特有的配置，其中 redisOptions 包含了每个节点的通用配置
        const client = new Redis.Cluster(redisClusterNodes, {
          redisOptions: redisClusterCommonOptions, // 传入每个节点的通用 RedisOptions
          maxRedirections: redisClusterSpecificOptions.maxRedirections,
          scaleReads: redisClusterSpecificOptions.scaleReads,
          // 如果你的 keyPrefix 应该在 Cluster 级别设置，也可以直接放在这里
          // keyPrefix: redisClusterCommonOptions.keyPrefix,
        });

        // 监听连接成功事件
        client.on('connect', () => {
          console.log('✅ 成功连接到 Redis 集群！');
        });

        // 监听错误事件
        client.on('error', (err) => {
          console.error('❌ Redis 集群连接错误:', err);
          // 在生产环境中，你可能需要更复杂的错误处理，例如告警通知
        });

        // 监听 ready 事件，表示集群已准备好接受命令
        client.on('ready', () => {
          console.log('✨ Redis 集群已准备就绪！');
        });

        // 监听 close 事件，表示连接已断开
        client.on('close', () => {
          console.warn('⚠️ Redis 集群连接已断开！');
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLUSTER_CLIENT], // 导出这个提供者，以便其他模块可以注入它
})
export class RedisModule {}