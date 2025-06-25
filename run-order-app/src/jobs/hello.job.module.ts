// src/jobs/hello.job.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HelloJobProcessor } from './hello.job.processor';
import { HelloJobService } from './hello.job.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'hello',
      redis: {
        host: 'localhost', // Redis 主机地址
        port: 6379,                // Redis 端口
        // db: 0,                   // 可选，指定数据库索引，默认是 0
      },
    }),
   
  ],
  providers: [HelloJobProcessor, HelloJobService],
  exports: [HelloJobService], // 如果其他模块需要使用这个服务，可以导出
})
export class HelloJobModule {}