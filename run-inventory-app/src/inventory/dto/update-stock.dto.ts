import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class UpdateStockDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @Min(1) // 扣减数量必须大于0
  @IsNotEmpty()
  quantity: number;

  // 乐观锁需要原始版本号
  @IsInt()
  @Min(1)
  version?: number;
}