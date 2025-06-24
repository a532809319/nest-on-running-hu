import {
  Controller,
  Post,
  Body,
  BadRequestException
} from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('订单服务')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @ApiOperation({ summary: '创建新订单' })
  @ApiResponse({ status: 201, description: '订单创建成功' })
  @ApiResponse({ status: 400, description: '库存不足或创建失败' })
  @Post()
  async createOrder(
    @Body() body: {
      productId: string;
      productName: string;
      quantity: number;
      userId: string;
    }
  ) {
    try {
      
      if (!body) {
        throw "请求为添参数为空 createOrder"
      }
      return await this.orderService.createOrder(
        body.productId,
        body.productName,
        body.quantity,
        body.userId
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

}