import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { QuickNodeService } from '../../quicknode-service/quicknode-service.service';
import { HttpModule } from '@nestjs/axios';
import { MempoolProcessor } from './processors/mempool.processor';
import { ConfigService } from '@nestjs/config';
import { RocksDbService } from '../../rocks-db/rocks-db-service.service';

@Module({
  imports: [HttpModule],
  providers: [CronService, QuickNodeService, MempoolProcessor, RocksDbService],
})
export class CronModule {}
