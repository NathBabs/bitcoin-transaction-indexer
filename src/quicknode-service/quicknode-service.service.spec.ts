import { Test, TestingModule } from '@nestjs/testing';
import { QuickNodeService } from './quicknode-service.service';

describe('QuickNodeService', () => {
  let service: QuickNodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuickNodeService],
    }).compile();

    service = module.get<QuickNodeService>(QuickNodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
