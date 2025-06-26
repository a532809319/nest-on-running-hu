import { Controller, Logger, Post, Body, HttpCode, HttpStatus, ParseIntPipe, Get, Param, HttpException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InitializeStockDto } from './dto/initialize-stock.dto';

@Controller('inventory') // HTTP 路由前缀
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  // HTTP POST 接口，用于初始化或设置商品库存
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
  @Post('add-stock')
  @HttpCode(HttpStatus.OK)
  async addStock(@Body() updateStockDto: UpdateStockDto): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Received HTTP request to add stock: ${JSON.stringify(updateStockDto)}`);
    const success = await this.inventoryService.increaseStock(updateStockDto);
    if (success) {
      return { success: true, message: 'Stock added successfully.' };
    } else {
      return { success: false, message: 'Failed to add stock.' };
    }
  }

  // HTTP GET 接口，供员工查询库存
  @Get(':productId')
  async getStock(@Param('productId', ParseIntPipe) productId: number) {
    this.logger.log(`Received HTTP request to get stock for product ID: ${productId}`);
    const product = await this.inventoryService.getProductStock(productId);
    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
   
    return product
  }

  // --- 以下是 RabbitMQ 微服务消息模式处理器 ---

  @MessagePattern('decrease_stock_pessimistic')
  async decreaseStockPessimistic(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received MQ request to decrease stock (pessimistic lock) for product ${data.productId} by ${data.quantity}`);
    return await this.inventoryService.decreaseStockPessimisticLock(data);
  }

  @MessagePattern('decrease_stock_optimistic')
  async decreaseStockOptimistic(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received MQ request to decrease stock (optimistic lock) for product ${data.productId} by ${data.quantity}`);
    return await this.inventoryService.decreaseStockOptimisticLock(data);
  }

  @MessagePattern('decrease_stock_lua')
  async decreaseStockLua(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received MQ request to decrease stock (Lua atomic) for product ${data.productId} by ${data.quantity}`);
    console.log("收到的数据：",data)
    return await this.inventoryService.decreaseStockByLua(data);
  }

  @MessagePattern('increase_stock')
  async increaseStockMQ(@Payload() data: UpdateStockDto): Promise<boolean> {
    this.logger.log(`Received MQ request to increase stock for product ${data.productId} by ${data.quantity} (rollback).`);
    return await this.inventoryService.increaseStock(data);
  }

  @MessagePattern('get_product_stock')
  async getProductStockMQ(@Payload() productId: number) {
   const stock= await this.inventoryService.getProductStock(productId)
    this.logger.log(`查到库存get_product_stock： stock--->${stock}<Received MQ request to get product stock for ID: ${productId}`);
    return  stock;
  }
}