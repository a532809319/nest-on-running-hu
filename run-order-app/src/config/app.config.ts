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
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT as any, 10) || 6379,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL as any, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT as any, 10) || 100,
  },
}));