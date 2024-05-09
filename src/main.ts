import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port).then(() => {
    console.log(`Hi there, Welcome to Bitcoin Transaction Indexer 🌕`);
  });
}
bootstrap();
