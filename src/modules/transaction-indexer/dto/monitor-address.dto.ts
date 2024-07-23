/**
 * DTO for user input to monitor address
 */

import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsEnum,
  IsOptional,
} from 'class-validator';

/**
 * An enum for the transaction types to monitor
 */
export enum TransactionType {
  ALL = 'ALL',
  DEPOSIT = 'DEPOSIT',
  TRANSFER = 'TRANSFER',
}

export class MonitorAddressDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  webhookUrl: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsString()
  @IsOptional()
  maximumConfirmations?: number;
}

/**
 * export the type of the class above
 */
type ClassProperties<C> = {
  [Key in keyof C as C[Key] extends Function ? never : Key]: C[Key];
};

export type MonitorAddressDtoType = ClassProperties<MonitorAddressDto>;
