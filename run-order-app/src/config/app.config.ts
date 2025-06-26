import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT as any, 10) || 3306,
     username: process.env.DB_USERNAME || 'user',
    password: process.env.DB_PASSWORD || 'pass',
    database: process.env.DB_DATABASE || 'inventory_db',
  },
 redis: {
    // 不再是单个 host/port
    // host: process.env.REDIS_HOST || 'localhost',
    // port: parseInt(process.env.REDIS_PORT, 10) || 6379,
     clusterNodes: process.env.REDIS_CLUSTER_NODES
      ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port, 10) };
        })
      : [{ host: 'localhost', port: 8001 }], // 默认至少一个节点
    clusterOptions: {
          redisOptions: {
            // 在集群模式下，可以配置 Redis 客户端的额外选项
            // 例如，连接超时，用户名密码等
            // password: 'your-redis-password' // 如果你的 Redis Cluster 设置了密码
          },
          // scaleReads: 'all' // 如果需要从所有副本读取，请取消注释
    }


  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL as any, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT as any, 10) || 100,
  },
}));