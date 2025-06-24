








要求   mac  本地node 版本 v23.5.0
库存
初始化鞋子库存 (10双):
docker-compose up -d  # -d 表示后台运行
curl -X POST http://localhost:3001/inventory/init \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "shoe_1",
    "name": "Running Shoes",
    "stock": 10
  }'
redis 缓存
curl http://localhost:3001/inventory/cache/shoe_1
# 期望返回: {"productId":"shoe_1","cacheStock":10}




创建订单:
curl -X POST http://localhost:3000/order \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "shoe_1",
    "quantity": 1,
    "userId": "user_123"
  }'











