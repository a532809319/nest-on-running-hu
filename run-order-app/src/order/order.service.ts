import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { CreateOrderDto} from './dto/create-order.dto';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { firstValueFrom } from 'rxjs'; // 导入 firstValueFrom

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @Inject('INVENTORY_SERVICE') private readonly inventoryServiceClient: ClientProxy, // 库存服务客户端
    @InjectQueue('order_timeout') private orderTimeoutQueue: Queue, // 订单超时队列
  ) {}

  /**
   * 创建订单并尝试扣减库存
   * 根据选择的策略 (乐观锁、悲观锁、Lua原子操作) 调用库存服务。
   * @param createOrderDto 创建订单 DTO
   * @returns Promise<Order>
   */
  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    const { productId, quantity, userId, strategy = 'lua' } = createOrderDto;

    // 1. 创建待处理订单 (PENDING)
    const order = this.orderRepository.create({
      productId,
      quantity,
      userId,
      totalPrice: 0, // 初始价格为0，后续从库存服务获取商品价格后更新
      status: OrderStatus.PENDING,
    });
    await this.orderRepository.save(order);
    this.logger.log(`Order ${order.id} created with PENDING status for product ${productId}.`);
      console.log("debug----")

    try {
      // 2. 从库存服务获取商品信息 (包括价格和版本号，用于乐观锁)
      // 使用 firstValueFrom 将 Observable 转换为 Promise
      console.log("debugstart----")

      const stockinhand: any = await firstValueFrom(
        this.inventoryServiceClient.send('get_product_stock', productId)
      );
      console.log(stockinhand,"stockinhand----")
      if(stockinhand<=0){
            throw 0
      }
   
        
    
      order.totalPrice = stockinhand * quantity; // 计算总价
      await this.orderRepository.save(order); // 更新订单总价
      // 3. 根据选择的策略调用库存服务扣减库存
      let stockDecreased = false;
      let messagePattern: string;

      switch (strategy) {
        case 'optimistic':
          messagePattern = 'decrease_stock_optimistic';
          break;
        case 'pessimistic':
          messagePattern = 'decrease_stock_pessimistic';
          break;
        case 'lua':
        default:
          messagePattern = 'decrease_stock_lua';
          break;
      }

      this.logger.log(`Attempting to decrease stock for order ${order.id} using ${strategy} strategy.`);

      // 使用 firstValueFrom 将 Observable 转换为 Promise
      stockDecreased = await firstValueFrom(
        this.inventoryServiceClient.send(messagePattern, { productId, quantity })

        // this.inventoryServiceClient.send(messagePattern, { productId, quantity, version: product.version })
      );
        console.log("--messagePattern--stockDecreased -->>>>",stockDecreased,messagePattern)
      if (stockDecreased) {
        // 4. 库存扣减成功，更新订单状态为 PAID (简化，实际可能还有支付流程)
        order.status = OrderStatus.PAID;
        await this.orderRepository.save(order);
        this.logger.log(`Order ${order.id} status updated to PAID. Stock decreased successfully.`);

        // 5. 将订单添加到超时队列，用于处理长时间未支付的订单（即使这里直接PAID，也可以用于其他逻辑）
        await this.orderTimeoutQueue.add(
          'check_order_timeout',
          { orderId: order.id },
          { delay: 15 * 60 * 1000, removeOnComplete: true }, // 15分钟后执行，完成后移除任务
        );
        this.logger.log(`Order ${order.id} added to timeout queue.`);

        return order;
      } else {
        // 5. 库存扣减失败，取消订单并记录
        order.status = OrderStatus.CANCELLED;
        await this.orderRepository.save(order);
        this.logger.warn(`Failed to decrease stock for order ${order.id}. Order status set to CANCELLED.`);
        throw new HttpException('Failed to decrease stock, order cancelled.', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      console.log("https",typeof(error))
      if(error!=0){

          this.logger.error(`发起订单接口错误了。Error creating order ${order.id}: ${error.message}`);
      // 如果发生任何异常，尝试回滚库存 (补偿事务)
      await this.rollbackStock(productId, quantity, order.id);
      // 将订单状态设置为取消，无论是否成功回滚库存
      if (order.status !== OrderStatus.CANCELLED) {
        order.status = OrderStatus.CANCELLED;
        await this.orderRepository.save(order);
      }
      throw new HttpException(error.message || 'Order creation failed.', HttpStatus.INTERNAL_SERVER_ERROR);
    }else{
        console.log("--------------------")
            throw new HttpException("库存没了 等后台更新", HttpStatus.OK);

    }
      }
      
  }

  /**
   * 库存回滚逻辑 (补偿事务)
   * 当订单创建失败或取消时，将之前扣减的库存加回去。
   * @param productId 商品ID
   * @param quantity 数量
   * @param orderId 订单ID (可选，用于日志记录)
   */
  async rollbackStock(productId: number, quantity: number, orderId?: number): Promise<void> {
    this.logger.warn(`Attempting to rollback stock for product ${productId}, quantity ${quantity} (Order ID: ${orderId || 'N/A'}).`);
    try {
      // 使用 firstValueFrom 将 Observable 转换为 Promise
      const success = await firstValueFrom(
        this.inventoryServiceClient.send('increase_stock', { productId, quantity })
      );
      if (success) {
        this.logger.log(`Stock rollback successful for product ${productId}, quantity ${quantity} (Order ID: ${orderId || 'N/A'}).`);
      } else {
        this.logger.error(`Stock rollback failed for product ${productId}, quantity ${quantity} (Order ID: ${orderId || 'N/A'}). Manual intervention may be required.`);
      }
    } catch (error) {
      this.logger.error(`Error during stock rollback for product ${productId}, quantity ${quantity} (Order ID: ${orderId || 'N/A'}): ${error.message}. Manual intervention may be required.`);
    }
  }

  /**
   * 处理订单超时任务 (Bull 队列消费者)
   */
  @MessagePattern('check_order_timeout') // 监听订单超时队列的消息
  async handleOrderTimeout(@Payload() data: { orderId: number }) {
    const { orderId } = data;
    this.logger.log(`Checking order ${orderId} for timeout...`);

    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (order && order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.EXPIRED;
      await this.orderRepository.save(order);
      this.logger.warn(`Order ${orderId} has timed out and is now EXPIRED.`);

      // 执行库存回滚
      await this.rollbackStock(order.productId, order.quantity, order.id);
    } else if (order) {
      this.logger.log(`Order ${orderId} is already ${order.status}, no timeout action needed.`);
    } else {
      this.logger.warn(`Order ${orderId} not found when checking for timeout.`);
    }
  }

  async findAllOrders(): Promise<Order[]> {
    return this.orderRepository.find();
  }

  async findOrderById(id: number): Promise<Order|null> {
    return this.orderRepository.findOne({ where: { id } });
  }
}