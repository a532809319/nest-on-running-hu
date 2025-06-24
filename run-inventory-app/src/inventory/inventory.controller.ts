import { Controller, Post, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post('init')
  async initProduct(@Body() body: { productId: string; name: string; stock: number }) {
    if (!body) {
      throw "请求为添参数为空 init"
    }
    return this.inventoryService.initializeProduct(
      body.productId,
      body.name,
      body.stock
    );
  }

}