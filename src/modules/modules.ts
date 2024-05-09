import { Global, Module } from '@nestjs/common';
import { TransactionIndexerModule } from './transaction-indexer/transaction-indexer.module';
import { CronModule } from './cron/cron.module';
import { queuesConfig } from '../config/queues.config';
import { QueuesModule } from './queues.module';
import { BullModule } from '@nestjs/bull';

@Global()
@Module({
  imports: [
    QueuesModule.register({
      isGlobal: true,
      queues: Object.values(queuesConfig),
    }),
    CronModule,
    TransactionIndexerModule,
  ],
  providers: [],
})
export class Modules extends BullModule {}
