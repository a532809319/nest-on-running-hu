import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule); // HTTP server for staff interface
  const configService = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Microservice listener for RabbitMQ messages
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
         urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],

        queue: 'inventory_queue', // Inventory service listens on this queue
        queueOptions: {
          durable: false,
        },
      },
    },
  );
          console.log("xxxxxxxxrocess.env.RABBITMQ_URL.",process.env.RABBITMQ_URL)

  await app.startAllMicroservices(); // Start listening for microservice messages
  await app.listen(3002,'0.0.0.0'); // Start HTTP server on port 3002
  console.log('xxxxxIxxxxxxxxnventory Service is running on http://localhost:3002 and listening for RabbitMQ messages...');
}
bootstrap();