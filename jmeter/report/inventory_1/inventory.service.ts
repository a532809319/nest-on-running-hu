import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    private readonly redisService: RedisService
  ) {}

  async initializeProduct(productId: string, name: string, stock: number) {
    const product = await this.inventoryRepo.findOne({ where: { productId } });
    if (!product) {
      const newProduct = this.inventoryRepo.create({
        productId,
        name,
        stock,
        version: 1
      });
      await this.inventoryRepo.save(newProduct);
      await this.redisService.set(`stock:${productId}`, stock);
      await this.redisService.set(`stock_version:${productId}`, 1);
    } else {
      await this.inventoryRepo.update(
        { productId }, 
        { stock, version: 1 }
      );
      await this.redisService.set(`stock:${productId}`, stock);
      await this.redisService.set(`stock_version:${productId}`, 1);
    }
    
    return { success: true };
  }

  async confirmDeductStock(productId: string, quantity: number, version: number) {
    const result :any = await this.inventoryRepo
      .createQueryBuilder()
      .update(Inventory)
      .set({
        stock: () => `stock - ${quantity}`,
        version: version + 1
      })
      .where('productId = :productId', { productId })
      // .andWhere('version = :version', { version })
      //暂时去掉库存版本逻辑
      .andWhere('stock >= :quantity', { quantity })
      .execute();

    if (result.affected > 0) {
      await this.redisService.set(`stock_version:${productId}`, version + 1);
    }
    return result.affected > 0;
  }
 
}