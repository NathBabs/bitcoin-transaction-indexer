import { Test, TestingModule } from '@nestjs/testing';
import { RocksDbService } from './rocks-db-service.service';

describe('RocksDbServiceService', () => {
  let service: RocksDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RocksDbService],
    }).compile();

    service = module.get<RocksDbService>(RocksDbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
