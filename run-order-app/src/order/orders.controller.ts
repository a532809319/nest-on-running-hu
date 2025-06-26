import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './order.service';

// @UseGuards(ThrottlerGuard) // 对所有 HTTP 路由应用限流
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    this.logger.log(`Received create order request: ${JSON.stringify(createOrderDto)}`);
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get()
  async findAll(): Promise<Order[]> {
    return this.ordersService.findAllOrders();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Order|null> {
    return this.ordersService.findOrderById(id);
  }

  // 监听 RabbitMQ 消息，处理订单超时任务
  @MessagePattern('check_order_timeout')
  async handleOrderTimeoutEvent(@Payload() data: { orderId: number }) {
    await this.ordersService.handleOrderTimeout(data);
  }
}