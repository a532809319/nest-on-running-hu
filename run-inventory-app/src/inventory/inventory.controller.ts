// inventory-service/src/inventory/inventory.controller.ts
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Param, ParseIntPipe, Post } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InitializeStockDto } from './dto/initialize-stock.dto';

@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}
 
 // HTTP POST 接口，用于初始化或设置商品库存
  // 路径: /inventory/initialize-stock
  @Post('initialize-stock')
  @HttpCode(HttpStatus.OK)
  async initializeStock(@Body() initializeStockDto: InitializeStockDto): Promise<{ success: boolean; product?: any; message?: string }> {
    this.logger.log(`Received HTTP request to initialize stock: ${JSON.stringify(initializeStockDto)}`);
    try {
      const product = await this.inventoryService.initializeProductStock(initializeStockDto);
      return { success: true, product, message: 'Product stock initialized successfully.' };
    } catch (error) {
      this.logger.error(`Failed to initialize stock: ${error.message}`);
      return { success: false, message: error.message || 'Failed to initialize stock.' };
    }
  }
 
      
 
 
  // HTTP POST 接口，供员工手动添加库存
  // 路径: /inventory/add-stock
  @Post('add-stock')
  @HttpCode(HttpStatus.OK) // 返回 200 OK
  async addStock(@Body() updateStockDto: UpdateStockDto): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Received HTTP request to add stock: ${JSON.stringify(updateStockDto)}`);
    // 调用 service 层的增加库存方法
    const success = await this.inventoryService.increaseStock(updateStockDto);
    if (success) {
      return { success: true, message: 'Stock added successfully.' };
    } else {
      // 实际应用中可以返回更具体的错误信息
      return { success: false, message: 'Failed to add stock.' };
    }
  }

  // HTTP GET 接口，供员工查询库存
  // 路径: /inventory/:productId
  @Get(':productId')
  async getStock(@Param('productId', ParseIntPipe) productId: number) {
    this.logger.log(`Received HTTP request to get stock for product ID: ${productId}`);
    const product = await this.inventoryService.getProductStock(productId);
    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
    return {
      productId: product.id,
      name: product.name,
      stock: product.stock,
      price: product.price,
      version: product.version,
    };
  }
  /**
   * 处理库存扣减请求 (悲观锁)
   * @param data UpdateStockDto
   * @returns boolean
   */
  @MessagePattern('decrease_stock_pessimistic')
  async decreaseStockPessimistic(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received request to decrease stock (pessimistic lock) for product ${data.productId} by ${data.quantity}`);
    console.log(" -=====decrease_stock_pessimistic",data)
    return await this.inventoryService.decreaseStockPessimisticLock(data);
  }

  /**
   * 处理库存扣减请求 (乐观锁)
   * @param data UpdateStockDto
   * @returns boolean
   */
  @MessagePattern('decrease_stock_optimistic')
  async decreaseStockOptimistic(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received request to decrease stock (optimistic lock) for product ${data.productId} by ${data.quantity}`);
    return await this.inventoryService.decreaseStockOptimisticLock(data);
  }

  /**
   * 处理库存扣减请求 (Lua 原子操作)
   * @param data UpdateStockDto
   * @returns boolean
   */
  @MessagePattern('decrease_stock_lua')
  async decreaseStockLua(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received request to decrease stock (Lua atomic) for product ${data.productId} by ${data.quantity}`);
    return await this.inventoryService.decreaseStockByLua(data);
  }

  /**
   * 处理库存增加请求 (用于回滚)
   * @param data UpdateStockDto
   * @returns boolean
   */
  @MessagePattern('increase_stock')
  async increaseStock(@Payload() data: UpdateStockDto): Promise<boolean> {
   console.log("景来 。。。。")
    this.logger.log(`Received request to increase stock for product ${data.productId} by ${data.quantity}`);
    return await this.inventoryService.increaseStock(data);
  }

  /**
   * 获取商品库存
   * @param productId 商品ID
   * @returns Product
   */
  @MessagePattern('get_product_stock')
  async getProductStock(@Payload() productId: number) {
    console.log("收到啊。。。",productId)
    this.logger.log(`sho收到：消息 ====Received request to get product stock for ID: ${productId}`);
    return await this.inventoryService.getProductStock(productId);
  }
}