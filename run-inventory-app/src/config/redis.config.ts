// src/config/redis.config.ts
export const redisConfig = {
  cluster: {
    nodes: [
      { host: 'localhost', port: 8001 },
      { host: 'localhost', port: 8002 },
      { host: 'localhost', port: 8003 },
      { host: 'localhost', port: 8004 },
      { host: 'localhost', port: 8005 },
      { host: 'localhost', port: 8006 },
    ],
    options: {
      // 连接重试策略
      maxRetriesPerRequest: 5,                // 每个请求最大重试次数
      retryStrategy(times: number) {
        return Math.min(times * 50, 2000);    // 重试间隔递增，最大2秒
      },
      
      // 超时设置
      connectTimeout: 5000,                   // 连接超时时间(ms)
      commandTimeout: 3000,                   // 命令执行超时时间(ms)
      
      // 自动重连
      enableAutoPipelining: true,             // 自动批处理命令
      autoResubscribe: true,                  // 自动重新订阅
      showFriendlyErrorStack: true,           // 友好的错误堆栈
    },
  },
};