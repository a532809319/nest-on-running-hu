import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Configure RabbitMQ microservice listener (for potential messages from inventory service, e.g., dead letter queue)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'order_queue', // Order service listens on this queue
      queueOptions: {
        durable: false,
      },
    },
  });

  await app.startAllMicroservices(); // 启动微服务监听
  const port=3003
  await app.listen(port,"0.0.0.0");

  console.log("order service running run-order-app startAllMicroservices   3003  connectMicroservice order_queue",port)
  console.log("order service running run-order-app startAllMicroservices   3003  connectMicroservice order_queue",port)
  console.log("order service running run-order-app  startAllMicroservices  3003  connectMicroservice order_queue",port)

  console.log("order service running run-order-app   startAllMicroservices 3003",port)
  console.log("order service running run-order-app    3003",port)
}
bootstrap();