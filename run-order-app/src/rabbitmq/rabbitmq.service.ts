import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';


@Injectable()
export class RabbitMQService {
  constructor(@Inject('RABBITMQ_CLIENT') private client: ClientProxy) {}
   // 添加显式返回类型 Promise<void>
  async publish<T>(pattern: string, data: T): Promise<void> {
    try {
      // 使用 lastValueFrom 处理 Observable
      this.client.emit(pattern, data);

    } catch (error) {
      console.error(`Error publishing to ${pattern}:`, error);
      // 在这里添加您的错误处理逻辑，如重试或日志记录
    }
  }
}

