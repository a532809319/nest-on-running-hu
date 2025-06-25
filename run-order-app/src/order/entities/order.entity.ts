import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
export enum OrderStatus {
  PENDING = 'PENDING',        // 待支付
  PAID = 'PAID',              // 已支付
  CANCELLED = 'CANCELLED',    // 已取消
  EXPIRED = 'EXPIRED',        // 已过期 (例如超时未支付)
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number; // 订单ID

  @Column()
  productId: number; // 商品ID

  @Column()
  quantity: number; // 购买数量

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number; // 订单总价

  @Column()
  userId: number; // 用户ID

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus; // 订单状态

  @CreateDateColumn()
  createdAt: Date; // 创建时间

  @UpdateDateColumn()
  updatedAt: Date; // 更新时间
}