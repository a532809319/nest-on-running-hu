// src/jobs/hello.job.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('hello') // 队列名称
export class HelloJobProcessor {
  @Process('helloJob') // 处理的任务名称
  handleHelloJob(job: Job) {
    console.log(`[HelloJob] 收到任务: ${job.data.message}`);
    // 这里可以执行异步任务，比如发送邮件、处理图片等
  }
}