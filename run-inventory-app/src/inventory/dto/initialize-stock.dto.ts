import { IsInt, Min, IsNotEmpty, IsNumber, IsOptional, Max } from 'class-validator';

export class InitializeStockDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  @IsNotEmpty()
  initialStock: number;

  @IsOptional()
  @IsNotEmpty()
  productName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  productPrice?: number;
}