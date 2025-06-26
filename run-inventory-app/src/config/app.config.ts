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
    clusterNodes: process.env.REDIS_CLUSTER_NODES
      ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.split(':');
        console.log(host,port,host,port)

          return { host, port: parseInt(port, 10) };
        })
      : [{ host: 'localhost', port: 10001 }], // 默认值也更新为 10001
    clusterOptions: {
      redisOptions: {
        // password: 'your-redis-password' // 如果你的 Redis Cluster 设置了密码
      },
    },
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
}));