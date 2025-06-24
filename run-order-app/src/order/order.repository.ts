import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(private dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }
  
  async createPendingOrder(
    orderId: string,
    productId: string,
    productName: string,
    quantity: number,
    userId: string
  ): Promise<Order> {
    const order = this.create({
      orderId,
      productId,
      productName,
      quantity,
      userId,
      status: 'pending'
    });
    
    return this.save(order);
  }
  
  async updateOrderStatus(
    orderId: string, 
    status: 'confirmed' | 'failed',
    transactionId?: any
  ): Promise<boolean> {
    const result:any = await this.update(
      { orderId },
      { 
        status,
        transactionId: status === 'confirmed' 
          ? transactionId || 'N/A'
          : null
      }
    );
    
    return result.affected > 0;
  }
}