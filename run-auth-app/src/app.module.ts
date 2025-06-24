import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuthInterceptor } from './interceptor/auth.interceptor';
import { error } from 'console';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
       cache: false,
       envFilePath: process.env.NODE_ENV=='production'?'.env.production':'.env',
    }),
      TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        console.log('NODE_ENV:', process.env.NODE_ENV); // 或通过 ConfigService 获取

     console.log('ConfigService xxxxxNODE_ENV:', configService); // 可能返回 undefined

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
    //added to the imports array
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, {
    provide: APP_INTERCEPTOR,
    useClass: AuthInterceptor,
  }],
})
export class AppModule {}
