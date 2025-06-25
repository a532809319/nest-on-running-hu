import { Entity, PrimaryGeneratedColumn, Column, VersionColumn } from 'typeorm';
@Entity('products') // 对应数据库中的 products 表
export class Product {
  @PrimaryGeneratedColumn()
  id: number; // 商品ID

  @Column({ length: 255 })
  name: string; // 商品名称

  @Column()
  stock: number; // 库存数量

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number; // 商品价格

  @VersionColumn()
  version: number; // 乐观锁版本号
}