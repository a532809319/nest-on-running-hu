import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards, Logger } from '@nestjs/common';
import { OrdersService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
// import { ThrottlerGuard } from '@nestjs/throttler';
import { MessagePattern, Payload } from '@nestjs/microservices'; // 导入 MessagePattern

// @UseGuards(ThrottlerGuard) // 对所有路由应用限流 后面打开 压测过后
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

  /**
   * 监听 RabbitMQ 消息，处理订单超时任务
   * 这里的 @MessagePattern("check_order_timeout") 告诉 NestJS 这是一个微服务事件处理器，
   * 当 RabbitMQ 队列 'order_timeout' 收到消息时，会触发此方法。
   * 注意：这个方法需要在 order-service 的 main.ts 中通过 app.connectMicroservice 注册 RMQ 传输器才能生效。
   */
  @MessagePattern('check_order_timeout')
  async handleOrderTimeoutEvent(@Payload() data: { orderId: number }) {
    await this.ordersService.handleOrderTimeout(data);
  }
}