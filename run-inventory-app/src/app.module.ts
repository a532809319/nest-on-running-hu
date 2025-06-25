import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
// import { StockConsumer } from './inventory_1/stock.consumer';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
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
         
       
        console.log("('DB_HOST-xxx-->>>')",configService.get<string>('DB_HOST'))
          console.log('NODE_ENV:', process.env.NODE_ENV); // 或通过 ConfigService 获取
     console.log('ConfigService NODE_ENV:', configService.get('NODE_ENV')); // 可能返回 undefined
        console.log("('REDIS_HOST---')",configService.get<string>('REDIS_HOST'))
        console.log("('DB_USERNAME---')",configService.get<string>('DB_USERNAME'))
        console.log("('DB_PASSWORD---')",configService.get<string>('DB_PASSWORD'))
       
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
    AuthModule,
    InventoryModule
    
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {}
