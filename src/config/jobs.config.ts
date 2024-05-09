import { CronExpression } from '@nestjs/schedule';

type JobConfig = {
  name: string;
  cron: CronExpression | string;
};

export const jobConfigs: { [key: string]: JobConfig } = {
  monitorMempoolJob: {
    name: 'Monitor Mempool Job',
    cron: CronExpression.EVERY_HOUR,
  },
  retrieveNewBlocksJob: {
    name: 'Retrieve New Blocks Job',
    cron: CronExpression.EVERY_30_MINUTES,
  },
};
