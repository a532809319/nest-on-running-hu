import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port=3003
  await app.listen(port);
  console.log("order service running run-order-app    3002",port)
  console.log("order service running run-order-app    3002",port)
  console.log("order service running run-order-app    3002",port)
}
bootstrap();
