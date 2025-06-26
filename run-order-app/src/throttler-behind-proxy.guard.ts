import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): any {
    // 优先使用 X-Forwarded-For 头部获取真实 IP，否则使用 req.ip
    return req.headers['x-forwarded-for'] || req.ip;
  }
}