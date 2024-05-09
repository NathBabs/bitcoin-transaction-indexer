import { Module } from '@nestjs/common';
import { TransactionIndexerService } from './transaction-indexer.service';
import { TransactionIndexerController } from './transaction-indexer.controller';

@Module({
  providers: [TransactionIndexerService],
  controllers: [TransactionIndexerController]
})
export class TransactionIndexerModule {}
