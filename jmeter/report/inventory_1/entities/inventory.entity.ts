import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  productId: string;

  @Column()
  name: string;

  @Column()
  stock: number;

  @Column({ default: 1 })
  version: number;
}