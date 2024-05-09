import { ConfigurableModuleBuilder } from '@nestjs/common';
import { BullModuleOptions } from '@nestjs/bull';

export interface QueueModuleOption {
  queues: BullModuleOptions[];
}

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  ASYNC_OPTIONS_TYPE,
  OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<QueueModuleOption>()
  .setExtras(
    {
      isGlobal: true,
    },
    (definition, extras) => ({
      ...definition,
      global: extras.isGlobal,
    }),
  )
  .build();
