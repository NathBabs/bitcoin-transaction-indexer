import { Module } from '@nestjs/common';
import { TransactionIndexerService } from './transaction-indexer.service';
import { TransactionIndexerController } from './transaction-indexer.controller';
import { RocksDbModule } from '../rocks-db/rocks-db.module';

@Module({
  imports: [RocksDbModule],
  providers: [TransactionIndexerService],
  controllers: [TransactionIndexerController],
})
export class TransactionIndexerModule {}
