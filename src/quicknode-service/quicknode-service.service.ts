import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { RPC, RPCOptions } from 'rpc-request';
import { catchError, lastValueFrom, map } from 'rxjs';

interface RPCHeader {
  'Content-Type': string;
  //   Authorization: string;
}

type methods = 'getblockcount' | 'getrawmempool' | 'getblock' | 'getblockhash';

@Injectable()
export class QuickNodeService {
  private readonly logger = new Logger(QuickNodeService.name);
  private readonly quickNodeUrl: string;
  private readonly auth: string;
  private readonly headers: RPCHeader;
  private readonly body = {
    // jsonrpc: '2.0',
    // id: 1 || 'rpc-bitcoin',
    method: '',
    params: [],
  };
  private readonly options: RPCOptions = {};

  constructor(private readonly httpService: HttpService) {
    // super({ uri: '/', ...this.options });

    const { QUICKNODE_ENDPOINT, QUICKNODE_TOKEN } = process.env;

    if (!QUICKNODE_ENDPOINT || !QUICKNODE_TOKEN) {
      this.logger.error('Missing quick node credentials, please fix');
      throw new Error('No credentials to connect to Quick Node server');
    }

    this.quickNodeUrl = `${QUICKNODE_ENDPOINT}/${QUICKNODE_TOKEN}`;
    // this.auth = Buffer.from(`${rpcuser}:${rpcpassword}`).toString('base64');
    this.headers = {
      'Content-Type': 'application/octet-stream',
      //   Authorization: `Basic ${this.auth}`,
    };

    this.options = {
      method: 'POST',
      headers: this.headers,
      body: this.body,
    };
  }

  async getrawmempool({ verbose = false }) {
    this.body.method = 'getrawmempool';
    // const O = { ...this.options, body: this.body };

    try {
      const response = await this.post('getrawmempool', [verbose]);
      if (response.error) {
        throw response.error;
      }

      return response.result;
    } catch (error) {
      if (error.error && error.error.error && error.error.result === null) {
        throw error;
      }

      throw error;
    }
  }

  /**
   *  a method for getting getblockcount
   */
  async getblockcount() {
    this.body.method = 'getblockcount';

    try {
      const response = await this.post('getblockcount', []);

      if (response.error) {
        throw response.error;
      }

      return response.result;
    } catch (error) {
      this.logger.log(
        `::: error getting block count ${JSON.stringify(error)} :::`,
      );
      throw error;
    }
  }

  /**
   * a method for getting getblockhash
   * @param height
   */
  async getblockhash(height: number) {
    this.body.method = 'getblockhash';
    try {
      const response = await this.post('getblockhash', [height]);

      if (response.error) {
        throw response.error;
      }

      return response.result;
    } catch (error) {
      this.logger.log(
        `::: error getting block hash ${JSON.stringify(error)} :::`,
      );
      throw error;
    }
  }

  /**
   * a method for returning information about a block
   * @param hash
   * @param verbosity
   */
  async getblock(hash: string, verbosity: 0 | 1 | 2 = 0) {
    this.body.method = 'getblock';

    try {
      const response = await this.post('getblock', [hash, verbosity]);

      if (response.error) {
        throw response.error;
      }

      return response.result;
    } catch (error) {
      this.logger.log(`::: error getting block ${JSON.stringify(error)} :::`);
      throw error;
    }
  }

  /**
   * post function to be reused by other methods
   */
  async post(method: methods, params: any[]) {
    this.body.method = method;
    this.body.params = params;
    // const O = { ...this.options, body: this.body };

    const response = await lastValueFrom(
      this.httpService
        .post(this.quickNodeUrl, this.body, {
          headers: {
            'Content-Type': 'application/json',
            // Authorization: `Basic ${this.auth}`,
          },
        })
        .pipe(map((response) => response.data))
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.log(JSON.stringify(error));
            throw error;
          }),
        ),
    );

    return response;
  }
}
