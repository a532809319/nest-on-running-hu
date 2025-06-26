import { ClusterNode, RedisOptions } from 'ioredis';

// 定义 Redis 集群的节点列表


export const redisClusterNodes: ClusterNode[] = [
  { host: 'localhost', port: 8001 },
      { host: 'localhost', port: 8002 },
      { host: 'localhost', port: 8003 },
      { host: 'localhost', port: 8004 },
      { host: 'localhost', port: 8005 },
      { host: 'localhost', port: 8006 },
  // **重要：** 请根据你的实际 Redis 集群节点信息进行替换。
  // 通常，你只需要提供部分主节点的地址，ioredis 会自动发现集群中的所有节点。
];

// 定义 Redis 集群连接的通用选项，这些选项将应用于集群中的每个 Redis 实例
export const redisClusterCommonOptions: RedisOptions = {
  password: 'your_redis_password', // 如果你的 Redis 集群需要密码认证
  // enableTLS: true, // 如果使用 TLS/SSL 连接
  // tls: { /* ... TLS 证书配置 ... */ },
  // family: 4, // 强制 IPv4 或 IPv6
  // 例如，如果你想为所有键添加一个统一的前缀
  keyPrefix: 'my_nestjs_app:',
  maxRetriesPerRequest: null, // 禁用单次请求重试，让ioredis自行处理集群重定向
  retryStrategy: (times) => { // 自定义重试策略
    const delay = Math.min(times * 50, 2000); // 每次重试延迟增加，最大2秒
    console.log(`Redis 连接重试 ${times} 次，延迟 ${delay}ms`);
    return delay;
  },
  // 可以添加更多 ioredis 支持的 RedisOptions
};

// 定义 Redis 集群特有的选项
export const redisClusterSpecificOptions = {
  // 当连接重定向过多时的最大重定向次数，默认是 16
  maxRedirections: 16,
  // 读写分离策略：
  // 'master': (默认) 所有读操作都发送到主节点
  // 'slave': 优先从从节点读取，如果从节点不可用则从主节点读取
  // 'all': 随机从主节点或从节点读取
  scaleReads: 'slave' as const, // 使用 'as const' 确保类型推断为字面量类型
  // clusterRetryStrategy: (times) => { /* 自定义集群层面的重试 */ }
};