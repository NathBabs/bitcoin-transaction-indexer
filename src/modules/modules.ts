import { Global, Module } from '@nestjs/common';
import { TransactionIndexerModule } from './transaction-indexer/transaction-indexer.module';
import { CronModule } from './cron/cron.module';
import { queuesConfig } from '../config/queues.config';
import { QueuesModule } from './queues.module';
import { BullModule } from '@nestjs/bull';
import { RocksDbModule } from './rocks-db/rocks-db.module';

@Global()
@Module({
  imports: [
    QueuesModule.register({
      isGlobal: true,
      queues: Object.values(queuesConfig),
    }),
    CronModule,
    TransactionIndexerModule,
    RocksDbModule,
  ],
  providers: [],
})
export class Modules extends BullModule {}
