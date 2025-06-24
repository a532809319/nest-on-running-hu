import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMQService } from './rabbitmq.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'stock_deduction',
          queueOptions: {
            durable: true
          }
        }
      }
    ])
  ],
  providers: [RabbitMQService],
  exports: [RabbitMQService]
})
export class RabbitMQModule {}