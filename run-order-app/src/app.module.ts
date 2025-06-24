import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './redis/redis.module';
import { AppService } from './app.service';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { OrderModule } from './order/order.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
      TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          console.log( configService.get<string>('DB_SYNCHRONIZE'))

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
    RedisModule,
    RabbitMQModule,
    OrderModule
    //added to the imports array
  ],
  // controllers: [AppController],
  providers: [AppService],
   controllers: [AppController],
  exports: [],
})
export class AppModule {}
