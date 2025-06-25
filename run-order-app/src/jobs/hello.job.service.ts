// src/jobs/hello.job.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class HelloJobService {
  constructor(@InjectQueue('hello') private helloQueue: Queue) {}

  async addHelloJob(message: string) {
    await this.helloQueue.add('helloJob', { message });
    console.log(`[HelloJobService] 已添加任务: ${message}`);
  }
}