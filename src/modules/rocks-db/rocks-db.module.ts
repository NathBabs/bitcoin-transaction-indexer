import { Module, Global } from '@nestjs/common';
import { RocksDbService } from './rocks-db-service.service';

@Global()
@Module({
  providers: [RocksDbService],
  exports: [RocksDbService],
})
export class RocksDbModule {}
