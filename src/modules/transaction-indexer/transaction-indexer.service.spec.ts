import { Test, TestingModule } from '@nestjs/testing';
import { TransactionIndexerService } from './transaction-indexer.service';

describe('TransactionIndexerService', () => {
  let service: TransactionIndexerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionIndexerService],
    }).compile();

    service = module.get<TransactionIndexerService>(TransactionIndexerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
