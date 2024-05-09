import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AbstractBatch } from 'abstract-leveldown';
import EncodingDown from 'encoding-down';
import levelup, { LevelUp } from 'levelup';
import RocksDB from 'rocksdb';

const delimitor = ':';

export interface BatchCommand {
  readonly type: 'put' | 'del';
  readonly bucket: string;
  readonly key: string | number;
  readonly value?: any;
}

@Injectable()
export class RocksDbService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(RocksDbService.name);

  private readonly _db: LevelUp<RocksDB>;

  constructor() {
    const fileDb = process.cwd() + process.env.DB_FILE_PATH;
    this._db = levelup(
      EncodingDown(RocksDB(fileDb), { valueEncoding: 'json' }),
      { maxOpenFiles: 5000 },
      (err: any) =>
        this._logger.error(`::: error while connecting to DB ${err} :::`),
    ) as any;
  }

  /**
   * implement OnModuleInit to open and clear the database
   * on app start
   * @returns
   */
  public async onModuleInit(): Promise<void> {
    try {
      // await this.put('test', 'test', {
      //   appName: 'Bitcoin Transaction Indexer',
      // });
      // this._logger.log(`::: test value in rocksdb inserted :::`);
      // const test = await this.get('test', 'test');
      // this._logger.log(
      //   `::: test value in rocksdb retrieved => ${JSON.stringify(test)}`,
      // );
      await this.clear();

      this._logger.log(
        '::: is DB operational => ' + this._db.isOpen() + ' :::',
      );
    } catch (error) {
      this._logger.error(
        `::: Error testing RocksDB connection: ${error.message} :::`,
      );
    }
  }

  public async onModuleDestroy() {
    // close the database connection
    // await this.close();
  }

  public async close(): Promise<void> {
    return this._db.close();
  }

  /**
   * a function to get a value using it's key
   * @param bucket
   * @param key
   * @param [log=true]
   * @returns
   */
  public async get(
    bucket: string,
    key: string | number,
    log = true,
  ): Promise<any> {
    const fullKey = `${bucket}${delimitor}${key}`;
    if (log) {
      this._logger.log(`::: get ${fullKey} :::`);
    }

    return this._db.get(fullKey as any);
  }

  /**
   * a function to check if a value exists
   * @param bucket
   * @param key
   * @param log
   * @returns
   */
  public async exists(
    bucket: string,
    key: string | number,
    log = true,
  ): Promise<boolean> {
    try {
      const fullKey = `${bucket}${delimitor}${key}`;

      /**
       * checks if log is true and logs the key for observability sake
       * does not log incase you are logging too much information (e.g in a loop)
       */
      if (log) {
        this._logger.log(`::: exists ${JSON.stringify({ key: fullKey })} :::`);
      }

      await this._db.get(fullKey as any);

      return true;
    } catch (error) {
      if (error.notFound) {
        return false;
      }
      throw error;
    }
  }

  /**
   * a function to insert a value using it's key
   * @param bucket
   * @param key
   * @param val
   * @param log
   * @returns
   */
  public async put(
    bucket: string,
    key: string,
    val: any,
    log = true,
  ): Promise<void> {
    const finalKey = `${bucket}${delimitor}${key}`;
    if (log) {
      this._logger.log(`::: put ${finalKey} :::`);
    }

    return this._db.put(finalKey, val);
  }

  /**
   * a function to delete a value using it's key
   * @param bucket
   * @param key
   * @param [log=true]
   * @returns
   */
  public async del(bucket: string, key: string, log = true): Promise<void> {
    const fullKey = `${bucket}${delimitor}${key}`;
    if (log) {
      this._logger.log(`::: del ${fullKey} :::`);
    }

    return this._db.del(fullKey);
  }

  /**
   * a function to clear the database
   */
  public async clear(): Promise<void> {
    return this._db.clear();
  }

  /**
   * a function to batch insert(put) or delete(del) values
   * @param commands
   * @returns
   */
  public async batch(commands: ReadonlyArray<BatchCommand>): Promise<void> {
    const parsedCommands = commands.map((command) => ({
      type: command.type,
      key: `${command.bucket}${delimitor}${
        typeof command.key === 'string' ? command.key : command.key.toString()
      }`,
      value: command.value,
    }));
    return this._db.batch(parsedCommands as AbstractBatch[]);
  }
}
