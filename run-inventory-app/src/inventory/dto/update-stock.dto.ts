import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class UpdateStockDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number; // 商品ID

  @IsInt()
  @IsNotEmpty()
  quantity: number; // 数量（正数表示增加，负数表示减少）

  // 可选：用于乐观锁的版本号
  @IsInt()
  @Min(1)
  version?: number;
}