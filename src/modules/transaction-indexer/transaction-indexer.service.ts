import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MonitorAddressDto } from './dto/monitor-address.dto';
import { RocksDbService } from '../rocks-db/rocks-db-service.service';
import { DATABASE_BUCKETS } from '../../utils/constants';

@Injectable()
export class TransactionIndexerService {
  private readonly logger = new Logger(TransactionIndexerService.name);
  constructor(private readonly rocksDbService: RocksDbService) {}

  async monitorAddress(monitorAddressDto: MonitorAddressDto) {
    try {
      const { address, transactionType, maximumConfirmations, webhookUrl } =
        monitorAddressDto;

      await this.rocksDbService.put({
        bucket: DATABASE_BUCKETS.monitored_address,
        key: address,
        val: {
          transactionType,
          ...(maximumConfirmations
            ? { maximumConfirmations: maximumConfirmations }
            : {}),
          webhookUrl,
        },
      });

      return monitorAddressDto;
    } catch (error) {
      this.logger.error(
        `::: error occured while creating monitor address details ${JSON.stringify(
          error,
        )}`,
      );

      throw new BadRequestException({
        message:
          error?.message ||
          'Error occured while creating monitor address details',
        errors: error,
      });
    }
  }
}
