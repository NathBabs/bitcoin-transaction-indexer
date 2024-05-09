import { BullModuleOptions } from '@nestjs/bull';
import { registerAs } from '@nestjs/config';

const registerer = registerAs(
  'queuesConfig',
  (): { [key: string]: BullModuleOptions } => ({
    monitorMempool: {
      name: 'monitor-mempool',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    },
  }),
);

export default registerer;

export const queuesConfig: { [key: string]: BullModuleOptions } = registerer();
