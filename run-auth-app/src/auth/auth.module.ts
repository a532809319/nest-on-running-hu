import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './strategy/local.strategy';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { jwtConstants } from './constants';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UsersModule, 
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '24h' },
    }),
      CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) =>{ 
          const secret = configService.get<string>('JWT_SECRET')
          
        console.log("('当前环境---》》》')",configService.get<string>('THIS_ENVIREMENT'))
        console.log("('当前文件---》》》')",configService.get<string>('FILE'))
       
        console.log("('DB_HOST-xxx-->>>')",configService.get<string>('DB_HOST'))

          console.log('NODE_ENV:', process.env.NODE_ENV); // 或通过 ConfigService 获取
     console.log('ConfigService NODE_ENV:', configService.get('NODE_ENV')); // 可能返回 undefined
        console.log("('REDIS_HOST---')",configService.get<string>('REDIS_HOST'))
        console.log("('DB_USERNAME---')",configService.get<string>('DB_USERNAME'))
        console.log("('DB_PASSWORD---')",configService.get<string>('DB_PASSWORD'))
       
        if (!secret) {
          throw new Error('JWT secret is not configured');
        }
       return {
        secret,
        secretOrPrivateKey: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') },
        store: 'redis',
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        ttl: configService.get<number>('REDIS_TTL'),
       
      }},
      inject: [ConfigService],
    }),

  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
