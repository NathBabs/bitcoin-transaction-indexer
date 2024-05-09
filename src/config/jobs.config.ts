import { CronExpression } from '@nestjs/schedule';

type JobConfig = {
  name: string;
  cron: CronExpression | string;
};

export const jobConfigs: { [key: string]: JobConfig } = {
  monitorMempoolJob: {
    name: 'Monitor Mempool Job',
    cron: CronExpression.EVERY_MINUTE,
    //'*/2 * * * *', //CronExpression.EVERY_, //'0 0,15,30,45 * * * *', // Every 15 Minutes (00, 15, 30, 45)
    // cron: '*/5 * * * * *',
  },
  retrieveNewBlocksJob: {
    name: 'Retrieve New Blocks Job',
    cron: CronExpression.EVERY_MINUTE, // 12 seconds past every 3 hours, to space the jobs // every 6 hours
  },
};
