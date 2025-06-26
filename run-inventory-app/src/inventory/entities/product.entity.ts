import { Entity, PrimaryGeneratedColumn, Column, VersionColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column()
  stock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @VersionColumn() // **乐观锁的关键：TypeORM 会自动管理这个版本号**
  version: number;
}