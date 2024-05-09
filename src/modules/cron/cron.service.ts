import { Injectable, Logger } from '@nestjs/common';
import { jobConfigs } from '../../config/jobs.config';
import { Cron } from '@nestjs/schedule';
import { QuickNodeService } from '../../quicknode-service/quicknode-service.service';
// import { stringify } from 'flatted';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { queuesConfig } from '../../config/queues.config';
import { fstat, writeFileSync } from 'fs';
import {
  BatchCommand,
  RocksDbService,
} from '../../rocks-db/rocks-db-service.service';
import {
  DATABASE_BUCKETS,
  MAX_RETRY_ATTEMPTS,
  RETRYABLE_STATUS_CODES,
} from '../../utils/constants';
import {
  catchError,
  delay,
  lastValueFrom,
  map,
  retry,
  retryWhen,
  scan,
  throwError,
  timer,
} from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectQueue('monitor-mempool')
    private readonly mempoolQueue: Queue,
    private readonly quickNodeService: QuickNodeService,
    private readonly rocksDbService: RocksDbService,
    private readonly httpService: HttpService,
  ) {}

  @Cron(jobConfigs.monitorMempoolJob.cron, {
    timeZone: process.env.TZ,
  })
  async monitorMempoolJob() {
    try {
      this.logger.log('::: starting monitor mempool job... :::');
      const response = await this.quickNodeService.getrawmempool({
        verbose: true,
      });

      this.mempoolQueue.add('new-mempool-job', {
        mempoolResponse: response,
      });
      this.logger.log(`::: sent mempool response to queue for processing :::`);
      this.logger.log(`---------------------`);
    } catch (error) {
      this.logger.error(
        `::: error in monitor mempool job => ${JSON.stringify(error)} :::`,
      );
      return;
    }
  }

  @Cron(jobConfigs.retrieveNewBlocksJob.cron, {
    timeZone: process.env.TZ,
  })
  async retrieveNewBlocks() {
    try {
      /**
       * we are also going to use this function to monitor the transactions
       * in the blocks for the list of monitored addresses
       */
      this.logger.log('::: starting retrieve new blocks job :::');

      /**
       * get block count
       */
      const blockCount = await this.quickNodeService.getblockcount();
      this.logger.log(`::: block count => ${blockCount} :::`);

      /**
       * get block hash
       */
      const blockHash = await this.quickNodeService.getblockhash(blockCount);
      this.logger.log(`::: block hash => ${blockHash} :::`);

      /**
       * get block
       */
      const block = await this.quickNodeService.getblock(blockHash, 2);
      this.logger.log({ tx: block.tx[0] }, `::: block details => :::`);
      this.mempoolQueue.add('new-block-job', {
        blockResponse: block,
      });

      return;
    } catch (error) {
      this.logger.error(
        `::: error in retrieve new blocks job => ${JSON.stringify(error)} :::`,
      );
      return;
    }
  }

  async processBlockResponse(job: Job<any>) {
    this.logger.log(`::: received job for block response in queue :::`);
    const blockResponse = job.data.blockResponse;

    // Block hash
    const blockHash = blockResponse.hash;

    // Timestamp
    const time = new Date(blockResponse.time * 1000);

    // Block height
    const blockHeight = blockResponse.height;

    const transactions = blockResponse.tx.map((tx: { txid: any }) => ({
      transactionId: tx.txid,
      ...tx,
      blockHash,
      blockHeight,
      time,
    }));

    // Process transactions in chunks of 100 or any size
    await this.processTransactionsInChunks(transactions, 100, 'block');
  }

  /**
   * function that receives job for processing mempool in the queue
   * @param job
   */
  async processMempoolResponse(job: Job<any>) {
    this.logger.log(`::: processing mempool response in queue:::`);
    const mempoolResponse = job.data.mempoolResponse;

    this.logger.log(
      `::: mempool response length => ${
        Object.keys(mempoolResponse).length
      } :::`,
    );

    const transactions = Object.keys(mempoolResponse).map((transactionId) => ({
      transactionId,
      ...mempoolResponse[transactionId],
    }));

    // Process transactions in chunks of 100
    await this.processTransactionsInChunks(transactions, 150, 'mempool');
  }

  /**
   * split transactions into chunks of defined size and process them
   * @param transactions
   * @param chunkSize
   */
  async processTransactionsInChunks(
    transactions: any[],
    chunkSize: number,
    type: 'mempool' | 'block',
  ) {
    const chunkPromises = [];
    for (let i = 0; i < transactions.length; i += chunkSize) {
      const chunks = transactions.slice(i, i + chunkSize);
      chunkPromises.push(
        type == 'mempool'
          ? this.processMempoolTransactions(chunks)
          : this.processBlockTransactions(chunks),
      );
    }

    await Promise.all(chunkPromises);
  }

  /**
   * a function to process, parse and format transactions from the mempool
   * and save in the DB
   * @param transactions
   * @returns
   */
  async processMempoolTransactions(transactions: any[]) {
    try {
      this.logger.log(`::: processing mempool transactions :::`);

      const parsedMempoolTransactionDetails = await Promise.all(
        transactions.map(async (tx) => {
          // Transaction hash
          const txHash = tx.transactionId;

          // Fees
          const fees = tx.fees;

          // Size
          const size = tx.vsize;

          // Time
          const time = new Date(tx.time * 1000);

          // Height
          const height = tx.height;

          // Depends
          const depends = tx.depends;

          /**
           * check if txHash exists in rocksdb, if it exists,
           * skip and don't return anything
           */
          const txExists = await this.rocksDbService.exists(
            DATABASE_BUCKETS.transactions,
            txHash,
            false,
          );

          if (txExists) {
            return;
          }

          return {
            bucket: DATABASE_BUCKETS.transactions,
            type: 'put',
            key: txHash,
            value: {
              txHash,
              fees,
              size,
              time,
              height,
              depends,
            },
          } as BatchCommand;
        }),
      );

      /**
       * batch write to rocksdb
       */
      await this.rocksDbService.batch(parsedMempoolTransactionDetails);

      this.logger.log('------------------------------------------------------');
      this.logger.log(
        `::: successfully written ${parsedMempoolTransactionDetails.length} transactions from 'getrawmempool' to the DB :::`,
      );
      this.logger.log(
        '-------------------------------------------------------',
      );

      return;
    } catch (error) {
      this.logger.error(
        `::: error in processing mempool transactions => ${JSON.stringify(
          error,
        )} :::`,
      );
      return;
    }
  }

  /**
   * a function to process, parse and format transactions from the block
   * and save in the DB
   * @param transactions
   */
  async processBlockTransactions(transactions: any[]) {
    try {
      this.logger.log(`::: processing block transactions :::`);

      let parsedBlockTransactionDetails = await Promise.all(
        transactions.map(async (tx) => {
          const txHash = tx.transactionId;

          // Transaction inputs and outputs
          const inputs = tx.vin.map((vin) => ({
            txid: vin.txid || null,
            vout: vin.vout || null,
            scriptSig: vin.scriptSig || null,
            sequence: vin.sequence || null,
          }));

          const outputs = tx.vout.map((vout) => ({
            value: vout.value || null,
            n: vout.n || null,
            scriptPubKey: vout.scriptPubKey || null,
          }));

          /**
           * check the address in vout, and see if it exists among the list of
           * addresses we are monitoring in the DB, if it exists in the DB
           * send the details of this transction to the webhook URL
           */

          const time = tx.time;
          const blockHeight = tx.blockHeight;
          const blockHash = tx.blockHash;

          /**
           * check if txHash exists in rocksdb, if it exists,
           * skip and don't return anything
           */
          const txExists = await this.rocksDbService.exists(
            DATABASE_BUCKETS.transactions,
            txHash,
            false,
          );

          if (txExists) {
            return;
          }

          outputs.map((output: { scriptPubKey: { address: any } }) => {
            const address = output?.scriptPubKey?.address;
            if (address) {
              this.logger.log(`::: address => ${address} :::`);
              if (
                this.rocksDbService.exists(
                  DATABASE_BUCKETS.monitored_address,
                  address,
                )
              ) {
                this.logger.log(
                  `::: transaction found for monitored address :::`,
                );
                this.sendTransactionToWebhook({
                  txHash,
                  inputs,
                  outputs,
                  time,
                  blockHeight,
                  blockHash,
                });
              }
            }
          });

          return {
            bucket: DATABASE_BUCKETS.transactions,
            type: 'put',
            key: txHash,
            value: {
              txHash,
              inputs,
              outputs,
              time,
              blockHeight,
              blockHash,
            },
          } as BatchCommand;
        }),
      );

      /**
       * filter out empty, null or negative values
       */
      parsedBlockTransactionDetails =
        parsedBlockTransactionDetails.filter(Boolean);

      /**
       * batch write to rocksdb
       */
      await this.rocksDbService.batch(parsedBlockTransactionDetails);

      this.logger.log('------------------------------------------------------');
      this.logger.log(
        `::: successfully written ${parsedBlockTransactionDetails.length} transactions from 'getblock' to the DB :::`,
      );
      this.logger.log(
        '-------------------------------------------------------',
      );

      return;
    } catch (error) {
      this.logger.error(
        `::: error in processing block transactions => ${error} :::`,
      );
      return;
    }
  }

  async sendTransactionToWebhook(transaction: any) {
    try {
      this.logger.log(`::: sending transaction to webhook :::`);
      // get WEBHOOK_URL from environment variable
      // check if it exists and t is a valid URL
      const webhookUrl = process.env.WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error('WEBHOOK_URL is not defined');
      }

      const parsedUrl = new URL(webhookUrl);
      if (!parsedUrl.protocol || !parsedUrl.hostname) {
        throw new Error('Invalid webhook URL');
      }

      // write a post request to the webhook with exponential backoff on failure
      const response = await lastValueFrom(
        this.httpService
          .post(
            webhookUrl,
            { transaction },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            map((response) => response.status),
            retry({
              count: MAX_RETRY_ATTEMPTS,
              delay: (error, retryCount) => {
                if (!RETRYABLE_STATUS_CODES.includes(error.status)) {
                  return throwError(
                    () => new Error('Non-retryable status code'),
                  );
                }
                const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                this.logger.log(
                  `Attempt ${retryCount}: retrying in ${retryDelay}ms`,
                );
                return timer(retryDelay);
              },
            }),
            catchError((error: AxiosError) => {
              this.logger.log(JSON.stringify(error));
              throw error;
            }),
          ),
      );

      this.logger.log(
        `::: successfully sent transaction to webhook ${webhookUrl}:::`,
      );

      return;
    } catch (error) {
      this.logger.error(
        `::: error in sending transaction to webhook => ${error} :::`,
      );
      return;
    }
  }
}
