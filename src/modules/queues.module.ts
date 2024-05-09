import { Global, Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from '../utils/queue-module/queue.module-definition';

@Global()
@Module({
  exports: [BullModule],
})
export class QueuesModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const bullboardAdapter = options.queues.map((queue) => ({
      name: queue.name,
      adapter: BullAdapter,
    }));
    return {
      imports: [
        BullModule.registerQueue(...options.queues),
        BullBoardModule.forFeature(...bullboardAdapter),
      ],
      ...super.register(options),
    };
  }
}
