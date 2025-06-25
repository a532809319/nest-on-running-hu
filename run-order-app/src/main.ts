import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
   // 设置全局验证管道
   
  // app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
// // 配置 RabbitMQ 微服务监听（用于处理库存服务回滚消息）
    app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.NODE_ENV=='production'?'amqp://rabbitmq:5672':'amqp://localhost:5672'],
      // queue: 'stock_deduction',
       queue: 'order_queue',
      queueOptions: { durable: true },
    },
  });
   app.connectMicroservice<MicroserviceOptions>({
  // 用于在服务中注入客户端
    transport: Transport.RMQ,
    options: {
      urls: [process.env.NODE_ENV=='production'?'amqp://rabbitmq:5672':'amqp://localhost:5672'],
      // queue: 'stock_deduction',
       queue: 'order_queue',
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices(); // 启动微服务监听
  const port=3003
  await app.listen(port,"0.0.0.0");

  console.log("order service running run-order-app    3003  connectMicroservice order_queue",port)
  console.log("order service running run-order-app    3003  connectMicroservice order_queue",port)
  console.log("order service running run-order-app    3003  connectMicroservice order_queue",port)

  console.log("order service running run-order-app    3003",port)
  console.log("order service running run-order-app    3003",port)
}
bootstrap();
