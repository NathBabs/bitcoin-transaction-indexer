import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import bs58 from 'bs58';

@Injectable()
export class Utils {
  chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

function sha256d(buffer) {
  const hash1 = crypto.createHash('sha256').update(buffer).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  return hash2;
}

function convertPKHToAddress(prefix, address) {
  const prefixBuffer = Buffer.from(prefix, 'hex');
  const addressWithPrefix = Buffer.concat([prefixBuffer, address]);

  // console.log(addressWithPrefix.toString('hex'));

  const checksum = sha256d(addressWithPrefix).slice(0, 4);
  // console.log(checksum.toString('hex'));

  const endHash = Buffer.concat([addressWithPrefix, checksum]);
  const newAddress = bs58.encode(endHash);
  // console.log(newAddress);

  return newAddress;
}

export function pubkeyToAddress(pubKey) {
  // Convert pubkey to bytes
  const pubKeyBuffer = Buffer.from(pubKey, 'hex');

  // Apply sha256
  const sha256Hash = crypto.createHash('sha256').update(pubKeyBuffer).digest();
  // console.log(sha256Hash.toString('hex'));

  // Apply ripemd160
  const ripemd160Hash = crypto
    .createHash('ripemd160')
    .update(sha256Hash)
    .digest();
  // console.log(ripemd160Hash.toString('hex'));

  // Prefix for testnet addresses
  const prefix = '6f'; // '\x6f' in hex

  return convertPKHToAddress(prefix, ripemd160Hash);
}
