import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { StockConsumer } from './stock.consumer';
import { RedisModule } from 'src/redis/redis.module';
import { Inventory } from './entities/inventory.entity';
 
@Module({
  imports: [
    RedisModule,
    TypeOrmModule.forFeature([Inventory])
  ],
  controllers: [InventoryController,StockConsumer],
  providers: [InventoryService],
    exports: [InventoryService],

  
})
export class InventoryModule {}