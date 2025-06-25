// inventory-service/src/inventory/dto/initialize-stock.dto.ts
import { IsInt, Min, IsNotEmpty, IsNumber, IsOptional, Max } from 'class-validator';

export class InitializeStockDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number; // 商品ID

  @IsInt()
  @Min(0) // 库存可以初始化为0
  @Max(1000000) // 假设最大库存量为100万，防止错误输入过大数字
  @IsNotEmpty()
  initialStock: number; // 要设置的初始库存数量

  @IsOptional() // 名称是可选的，如果商品不存在则需要提供
  @IsNotEmpty()
  productName?: string; // 如果是初始化新商品，需要提供商品名称

  @IsOptional() // 价格是可选的
  @IsNumber()
  @Min(0)
  productPrice?: number; // 如果是初始化新商品，需要提供商品价格
}