import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
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
} from '../rocks-db/rocks-db-service.service';
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
import {
  MonitorAddressDto,
  MonitorAddressDtoType,
  TransactionType,
} from '../transaction-indexer/dto/monitor-address.dto';
import * as bitcoin from 'bitcoinjs-lib';
import { pubkeyToAddress } from '../../utils/utils';
import { setTimeout } from 'node:timers/promises';

type transaction = {
  txHash: any;
  inputs: any;
  outputs: any;
  time: any;
  blockHeight: any;
  blockHash: any;
  confirmation?: any;
};

@Injectable()
export class CronService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CronService.name);
  private isRunning = false;
  private currentProcessingHeight: number;

  constructor(
    @InjectQueue('monitor-mempool')
    private readonly mempoolQueue: Queue,
    private readonly quickNodeService: QuickNodeService,
    private readonly rocksDbService: RocksDbService,
    private readonly httpService: HttpService,
  ) {
    // this.init();
  }
  onApplicationBootstrap() {
    // throw new Error('Method not implemented.');
    // await this.rocksDbService.initialize();
    this.syncMissedBlocks();
    this.startMonitoring();
  }

  private async init() {
    // // await this.rocksDbService.initialize();
    // this.syncMissedBlocks();
    // this.startMonitoring();
  }

  async syncMissedBlocks() {
    const lastProcessedBlock = await this.getInitialBlockHeight();

    // if (Number(lastProcessedBlock) === 0) return;
    const currentBlockHeight = await this.quickNodeService.getblockcount();

    this.logger.log(
      `::: syncMissedBlocks => last processed block ${lastProcessedBlock} and current block height ${currentBlockHeight} `,
    );

    if (Number(currentBlockHeight) > Number(lastProcessedBlock)) {
      this.mempoolQueue.add('sync-pending-blocks', {
        currentBlockHeight: Number(currentBlockHeight),
        lastProcessedBlock: Number(lastProcessedBlock),
      });

      this.logger.log(
        `Queued ${
          currentBlockHeight - lastProcessedBlock
        } missed blocks for processing`,
      );
    }
  }

  private async startMonitoring() {
    this.isRunning = true;

    this.currentProcessingHeight = await this.getInitialBlockHeight();
    while (this.isRunning) {
      try {
        await this.monitorMempoolJob();
        await this.retrieveNewBlocks();

        // Add a small delay
        await setTimeout(1500);
      } catch (error) {
        this.logger.error(`Error in monitoring loop: ${error.message}`);
        // Add a longer delay if an error occurs
        await setTimeout(5000);
      }
    }
  }

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

  async retrieveNewBlocks() {
    try {
      /**
       * we are also going to use this function to monitor the transactions
       * in the blocks for the list of monitored addresses
       */
      this.logger.log('::: starting retrieve new blocks job :::');

      /**
       * get the block hash of the current processing height, it will throw an
       * error if it doesn't exist, but will return a value if it exists
       */
      const blockExists = await this.quickNodeService.getblockhash(
        this.currentProcessingHeight,
      );

      if (blockExists) {
        this.logger.log(`::: block hash => ${blockExists} :::`);

        /**
         * get block
         */
        const block = await this.quickNodeService.getblock(blockExists, 2);
        this.logger.log({ tx: block.tx[0] }, `::: block details => :::`);
        this.mempoolQueue.add('new-block-job', {
          blockResponse: block,
        });

        /**
         * update last processed block
         */
        await this.rocksDbService.setLastProcessedBlock(
          this.currentProcessingHeight,
        );
        this.logger.log(
          `Queued block ${this.currentProcessingHeight} for processing`,
        );

        /**
         * increment current processing height
         */
        this.currentProcessingHeight++;

        return;
      } else {
        this.logger.log(
          `Block ${this.currentProcessingHeight} does not exist yet. Waiting........`,
        );
      }

      /**
       * get block count
       */
      // const blockCount = await this.quickNodeService.getblockcount();
      // this.logger.log(`::: block count => ${blockCount} :::`);

      /**
       * get block hash
       */
      // const blockHash = await this.quickNodeService.getblockhash(blockCount);
      // this.logger.log(`::: block hash => ${blockHash} :::`);
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

  async processPendingBlocks(
    job: Job<{ currentBlockHeight: any; lastProcessedBlock: any }>,
  ) {
    this.logger.log(`::: processing pending blocks :::`);
    const { currentBlockHeight, lastProcessedBlock } = job.data;

    for (let i = lastProcessedBlock + 1; i <= currentBlockHeight; i++) {
      const blockHash = await this.quickNodeService.getblockhash(i);
      const block = await this.quickNodeService.getblock(blockHash, 2);
      /**
       * add to process block queue
       */
      this.mempoolQueue.add('new-block-job', {
        blockResponse: block,
      });
    }
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
      await this.rocksDbService.batch(
        parsedMempoolTransactionDetails.filter(Boolean),
      );

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
          const inputs = tx.vin
            .map((vin) => ({
              txid: vin.txid || null,
              vout: vin.vout || null,
              scriptSig: vin.scriptSig || null,
              // asm: vin.scriptSig?.asm || null,
              // hex: vin.scriptSig?.hex || null,
              sequence: vin.sequence || null,
              /**
               * generate the wallet address from the asm if it is not an empty string
               */
              address:
                vin.scriptSig != null && vin.scriptSig?.asm.length > 0
                  ? pubkeyToAddress(vin.scriptSig.asm)
                  : null,
            }))
            .filter(Boolean);

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
           * skip and don't return anything becausewe have processed it
           * already
           */
          const txExists = await this.rocksDbService.get(
            DATABASE_BUCKETS.transactions,
            txHash,
            false,
          );

          let txConfirmations: any;

          if (txExists) {
            txConfirmations = txExists?.['confirmations']
              ? txExists?.['confirmations'] + 1
              : 0;
            await this.updateTransactionConfirmation(
              txHash,
              blockHeight,
              txExists,
            );
            return;
          }

          inputs.map(async (input) => {
            const address = input.address;

            if (address) {
              this.logger.log(`::: address => ${address}`);

              const existingAddress: Omit<MonitorAddressDtoType, 'address'> =
                await this.rocksDbService.get(
                  DATABASE_BUCKETS.monitored_address,
                  address,
                  false,
                );

              if (existingAddress) {
                this.logger.log(
                  `::: transaction found for monitored address => ${address} :::`,
                );

                /**
                 * send a notification to the web hook url if transactiion type
                 * is transfer or all
                 */
                const maxConfirmations =
                  existingAddress.maximumConfirmations ?? 0;
                if (
                  (existingAddress.transactionType &&
                    (existingAddress.transactionType ==
                      TransactionType.TRANSFER ||
                      existingAddress.transactionType ==
                        TransactionType.ALL)) ||
                  txConfirmations <= maxConfirmations
                ) {
                  this.sendTransactionToWebhook(
                    {
                      txHash,
                      inputs,
                      outputs,
                      time,
                      blockHeight,
                      blockHash,
                    },
                    existingAddress.webhookUrl,
                    `${TransactionType.TRANSFER} Transaction detected for ${address}`,
                  );
                }
              }
            }
          });

          outputs.map(async (output: { scriptPubKey: { address: any } }) => {
            const address = output?.scriptPubKey?.address;
            if (address) {
              // this.logger.log(`::: address => ${address} :::`);
              const existingAddress: Omit<MonitorAddressDtoType, 'address'> =
                await this.rocksDbService.get(
                  DATABASE_BUCKETS.monitored_address,
                  address,
                  false,
                );
              if (existingAddress) {
                this.logger.log(
                  `::: transaction found for monitored address => ${address} :::`,
                );

                // send a notification to the webhook url
                const maxConfirmations =
                  existingAddress.maximumConfirmations ?? 0;
                if (
                  (existingAddress.transactionType &&
                    (existingAddress.transactionType ==
                      TransactionType.DEPOSIT ||
                      existingAddress.transactionType ==
                        TransactionType.ALL)) ||
                  txConfirmations <= maxConfirmations
                ) {
                  this.sendTransactionToWebhook(
                    {
                      txHash,
                      inputs,
                      outputs,
                      time,
                      blockHeight,
                      blockHash,
                    },
                    existingAddress.webhookUrl,
                    `${TransactionType.DEPOSIT} Transaction detected for ${address}`,
                  );
                }
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
              confirmations: 1,
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

  async sendTransactionToWebhook(
    transaction: any,
    webhookUrl: string,
    message: string,
  ) {
    try {
      this.logger.log(`::: sending transaction to webhook :::`);
      // get WEBHOOK_URL from environment variable
      // check if it exists and t is a valid URL
      // const webhookUrl = process.env.WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error('WEBHOOK_URL is not defined');
      }

      const parsedUrl = new URL(webhookUrl);
      if (!parsedUrl.protocol || !parsedUrl.hostname) {
        throw new Error('Invalid webhook URL');
      }

      const data = {
        transaction,
        message,
      };

      // write a post request to the webhook with exponential backoff on failure
      const response = await lastValueFrom(
        this.httpService
          .post(webhookUrl, data, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
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

  private async getInitialBlockHeight(): Promise<number> {
    try {
      const lastProcessedBlock =
        await this.rocksDbService.getLastProcessedBlock();

      this.logger.log(
        `::: getInitialBlockHeight => last processed block ${lastProcessedBlock} :::`,
      );
      return lastProcessedBlock + 1;
    } catch (error) {
      this.logger.warn(
        'No last processed block found in DB. Starting from current block height.',
      );
      const currentBlockHeight = await this.quickNodeService.getblockcount();
      this.logger.log(
        `::: getInitialBlockHeight => current block HEIGHT  ${currentBlockHeight} :::`,
      );
      await this.rocksDbService.setLastProcessedBlock(currentBlockHeight);
      return currentBlockHeight;
    }
  }

  async updateTransactionConfirmation(
    txHash: string,
    blockHeight: number,
    initialValue: any,
  ) {
    const transactionBlockHeight = initialValue.blockHeight;
    const confirmations = blockHeight - transactionBlockHeight + 1;

    const updatedTransaction = {
      ...initialValue,
      confirmations,
    };

    // update confirmation in the DB
    await this.rocksDbService.put({
      bucket: DATABASE_BUCKETS.transactions,
      key: txHash,
      val: updatedTransaction,
      log: false,
    });

    this.logger.log(
      `Updated confirmations for transaction ${txHash}: ${confirmations}`,
    );
  }
}
