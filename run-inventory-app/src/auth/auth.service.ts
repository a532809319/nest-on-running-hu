import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
@Injectable()
export class AuthService {
  constructor(private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,

  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne({ "email": email });
    if (user && bcrypt.compare(user.password, await bcrypt.hash(pass, 10))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(userin: any) {
    const { username } = userin;
    const user = await this.usersService.findOne({ where: { username: username } });
    let accesstokenRids: any = '';
    let payload = {};
    if (user) {
      const payload = { username: user?.username, sub: user?.id };
      accesstokenRids = this.jwtService.sign(payload)
      await this.cacheManager.set(`user_${user?.id}`, accesstokenRids, 3600);
      await this.cacheManager.get(`user_${user.id}`);
      console.log("access_token:", accesstokenRids, user?.id);
    }

    return {
      access_token: accesstokenRids,
    };

  }
  async register(data) {
    const { username, password, email } = data;
    const existingUser = await this.usersService.findOne({ where: { username } });
    if (existingUser) {
      throw new UnauthorizedException('Username already exists');
    }
    data.password = await bcrypt.hash(data.password, 10)
    let response = await this.usersService.create(data);
    if (response) {
      const { password, ...result } = response;
      return result;
    }
  }
  decodeToken(token): any {
    return this.jwtService.decode(token)
  }
}