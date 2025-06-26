// order-service/src/orders/dto/create-order.dto.ts
import { IsInt, Min, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number; // 商品ID (假设是鞋子ID)

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number; // 购买数量

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  userId: number; // 用户ID

  // 可选：指定防超卖策略
  // 默认为 Lua，因为它通常在高并发下性能最佳且原子性强
  strategy?: 'optimistic' | 'pessimistic' | 'lua';
}