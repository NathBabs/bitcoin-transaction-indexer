import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CronService } from '../cron.service';
import { queuesConfig } from '../../../config/queues.config';

@Processor('monitor-mempool')
export class MempoolProcessor {
  private readonly logger = new Logger(MempoolProcessor.name);

  constructor(private readonly cronService: CronService) {}

  @Process('new-mempool-job')
  async handleMempoolProcess(job: any) {
    this.logger.log('::: processing new mempool job here =========> :::');
    this.cronService.processMempoolResponse(job);
  }

  @Process('new-block-job')
  async handleBlockProcess(job: any) {
    this.logger.log('::: processing new block job here =========> :::');
    this.cronService.processBlockResponse(job);
  }
}
