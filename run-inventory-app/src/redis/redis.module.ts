// src/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';
import { Logger } from '@nestjs/common';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLUSTER',
      useFactory: () => {
        const logger = new Logger('RedisCluster');
        const client = new Redis.Cluster(
          redisConfig.cluster.nodes,
          redisConfig.cluster.options,
        );

        // 连接状态监听
        client.on('connect', () => logger.log('Connected to Redis Cluster'));
        client.on('ready', () => logger.log('Redis Cluster is ready for operations'));
        client.on('reconnecting', (delay: number) => 
          logger.warn(`Reconnecting in ${delay}ms...`));
        client.on('close', () => logger.error('Connection to Redis Cluster closed'));
        
        // 错误处理
        client.on('error', (err: Error) => {
          logger.error(`Redis error: ${err.message}`, err.stack);
          
          // 可添加告警机制（如发送邮件、Slack通知等）
          if (err.message.includes('max retries reached')) {
            logger.error('Max connection retries reached! Check Redis cluster availability.');
          }
        });

        // 集群拓扑变更监听
        client.on('nodeAdded', (node: any) => 
          logger.log(`New node added: ${node.options.host}:${node.options.port}`));
        client.on('nodeRemoved', (node: any) => 
          logger.log(`Node removed: ${node.options.host}:${node.options.port}`));

        return client;
      },
    },
  ],
  exports: ['REDIS_CLUSTER'],
})
export class RedisModule {}