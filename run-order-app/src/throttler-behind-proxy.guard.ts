
import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.ips.length ? req.ips[0] : req.ip; // individualize IP extraction to meet your own needs
   // 优先使用 X-Forwarded-For 头部获取真实 IP，否则使用 req.ip
    // return req.headers['x-forwarded-for'] || req.ip;
  }
}



