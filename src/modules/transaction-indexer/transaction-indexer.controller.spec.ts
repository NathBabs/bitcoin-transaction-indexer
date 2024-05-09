import { Test, TestingModule } from '@nestjs/testing';
import { TransactionIndexerController } from './transaction-indexer.controller';

describe('TransactionIndexerController', () => {
  let controller: TransactionIndexerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionIndexerController],
    }).compile();

    controller = module.get<TransactionIndexerController>(TransactionIndexerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
