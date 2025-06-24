import { Controller, Request, Post, UseGuards, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt.auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    //  @UseGuards(LocalAuthGuard)
  
 

    @Get('profile')
    @UseGuards(JwtAuthGuard)

    getProfile(@Request() req) {
        console.log("进来profile");
        
        return req.user;
    }
}
