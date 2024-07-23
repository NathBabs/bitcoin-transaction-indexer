import { Module } from '@nestjs/common';
import { Modules } from './modules/modules';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuickNodeService } from './quicknode-service/quicknode-service.service';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { CronModule } from './modules/cron/cron.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (req, res) => ({
          context: 'HTTP',
        }),
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
          },
        },
      },
    }),
    HttpModule,
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT) ?? 6379,
          ...(process.env.REDIS_USER
            ? { password: process.env.REDIS_USER ?? null }
            : {}),
          ...(process.env.REDIS_PASSWORD
            ? { password: process.env.REDIS_PASSWORD ?? null }
            : {}),
          ttl: Number(process.env.REDIS_TTL) ?? 5,
        },
        prefix: process.env.REDIS_PREFIX,
      }),
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    Modules,
    CronModule,
  ],
  controllers: [],
  providers: [ConfigService, QuickNodeService],
})
export class AppModule {}
