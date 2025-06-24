
要求   mac  本地node 版本 v23.5.0
docker-compose up -d  # -d 表示后台运行
//docker 镜像 设置 --配置加速
{
  "registry-mirrors": ["https://docker.xuanyuan.me", "https://mirror.baidubce.com"]
}

1 npm i 或者pnpm i 





docker-compose down  # 停止并删除容器
docker-compose down -v  # 同时删除数据卷（慎用！会丢失数据）
注册
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "123",
    "password": "123",
    "email": "user@example.com"
  }'

、登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"123","password":"123"}'















   cnpm i @nestjs/core @nestjs/common @nestjs/platform-express reflect-metadata rxjs  @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs @nestjs/config @nestjs/typeorm typeorm mysql2 @nestjs/swagger swagger-ui-express redis cache-manager cache-manager-redis-store class-validator class-transformer

 cnpm i  --save-dev @types/passport-jwt @types/bcryptjs @types/cache-manager
