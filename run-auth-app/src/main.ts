import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port=3001
  await app.listen(port,"0.0.0.0");
  console.log("Auth-service 0.0.0.0running on port ",port)
  console.log("Auth-service 0.0.0.0running on port ",port)
  console.log("Auth-service 0.0.0.0running on port ",port)
}
bootstrap();
