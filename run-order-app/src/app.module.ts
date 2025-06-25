import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
// import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { OrdersModule } from './order/orders.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';
import { BullModule } from '@nestjs/bull';
import { HelloJobModule } from './jobs/hello.job.module';

@Module({
  imports: [
     BullModule.forRoot(
      {
      url:'redis://:@localhost:6379'
   
    }),

  // ),



      // BullModule.registerQueue({
      //   name: 'audio',
      //   connection: {
      //     port: 6380,
      //   },
      // });

     // 限流模块配置
     ThrottlerModule.forRoot({
      throttlers: [
        {
         ttl: parseInt(process.env.THROTTLE_TTL as any, 10) || 60, // 60秒
        limit: parseInt(process.env.THROTTLE_LIMIT as any, 10) || 100, // 100个请求
 
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: false,
      envFilePath: process.env.NODE_ENV == 'production' ? '.env.production' : '.env',

    }),
     
         
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        console.log("process.env.NODE_ENV", process.env.NODE_ENV)
        const url = process.env.NODE_ENV == 'production' ? 'redis://:@redis:6379' : 'redis://:@localhost:6379'
        console.log("redis..>>>>>", url)
        console.log("('DB_HOST-xxx-->>>')", configService.get<string>('DB_HOST'))
        console.log('NODE_ENV:', process.env.NODE_ENV); // 或通过 ConfigService 获取
        console.log('ConfigService NODE_ENV:', configService.get('NODE_ENV')); // 可能返回 undefined
        console.log("('REDIS_HOST---')", configService.get<string>('REDIS_HOST'))
        console.log("('DB_USERNAME---')", configService.get<string>('DB_USERNAME'))
        console.log("('DB_PASSWORD---')", configService.get<string>('DB_PASSWORD'))

        return {
          type: 'mysql',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        }

      },
      inject: [ConfigService],
    }),

    HelloJobModule,
    // RabbitMQModule,
    OrdersModule
    ,

    
    //added to the imports array
  ],
  // controllers: [AppController],
  // 全局应用限流守卫，支持代理后的真实IP
  providers: [AppService],
  //    {
  //     provide: APP_GUARD,
  //     useClass: ThrottlerBehindProxyGuard,
  //   },
  // ],
  controllers: [AppController],
  exports: [],
})
export class AppModule { }
