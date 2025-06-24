import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {

// const app = await NestFactory.createMicroservice<MicroserviceOptions>(
//   AppModule,
//   {
//     transport: Transport.RMQ,
//     options: {
//       urls: ['amqp://localhost:5672'],
//       queue: 'stock_deduction',
//       wildcards: true,
//     },
//   },
// );
// app.listen()
  // const app = await NestFactory.create(AppModule);
// app.start
   // 1. 创建 HTTP 服务
  const app = await NestFactory.create(AppModule);

  // 2. 连接 RabbitMQ 微服务
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'stock_deduction',
      queueOptions: { durable: true },
    },
  });

  // // 3. 启动微服务
  await app.startAllMicroservices();

  // // 4. 启动 HTTP 服务
const port=3002
  await app.listen(port);
  console.log("Auth-inventory running on port ",port)
  console.log("Auth-inventory running on port ",port)
  console.log('HTTP 服务已启``端口 ；RabbitMQ 微服务已连接。');
}
bootstrap();
