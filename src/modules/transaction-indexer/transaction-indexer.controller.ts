import { Body, Controller, Post } from '@nestjs/common';
import { TransactionIndexerService } from './transaction-indexer.service';
import { MonitorAddressDto } from './dto/monitor-address.dto';

@Controller('transaction-indexer')
export class TransactionIndexerController {
  constructor(
    private readonly transactionIndexerService: TransactionIndexerService,
  ) {}

  /**
   * endpoint to take in addresses to monitor, along with webhook url
   * and what types of transaction to monitor, either 'all', 'sent', 'received'
   */
  @Post('/monitor-address')
  async monitorAddresses(@Body() monitorAddressDto: MonitorAddressDto) {
    await this.transactionIndexerService.monitorAddress(monitorAddressDto);

    return {
      success: true,
      message: 'Address monitoring started',
      data: monitorAddressDto,
    };
  }
}
