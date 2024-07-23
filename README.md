## Description

A Bitcoin Transaction Indexer that indexes transactions found in the mempool and block. It also monitors specified wallet addresses and sends transaction to a webhook URL when such address is found in atransaction<br>

## Getting Started

Create a new folder for the rocksDB service

```bash
$ mkdir ./src/db-storage
```

Create an `.env` file and fill the variables as specified in the `.env.example` file

```bash
$ touch .env
```

There is a provided docker compose file with a specified redis image you can use<br> if you do not already have a redis instance, this is needed for the Queue to run.

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Endpoint for creating address to be monitored along with webhook

Post `/transaction-indexer/monitor-address`

body

```json
{
  "address": "msVud4spUee6VkjqaDQfnN5PA4GuPSH1R9",
  "webhookUrl": "https://webhook.site/2435f6e5-1fff-4222-adf8-c599379133b6",
  "transactionType": "ALL"
}
```

Response

```json
{
  "success": true,
  "message": "Address monitoring started",
  "data": {
    "address": "msVud4spUee6VkjqaDQfnN5PA4GuPSH1R9",
    "webhookUrl": "https://webhook.site/2435f6e5-1fff-4222-adf8-c599379133b6",
    "transactionType": "ALL"
  }
}
```

## Screenshots

### Processing transactions from mempool

<img width="1105" alt="Screenshot 2024-05-09 at 03 15 45" src="https://github.com/NathBabs/bitcoin-transaction-indexer/assets/17989552/a627cacb-5c0a-49fb-a9fe-5c8050cfeef4">

### Processing transactions from block

<img width="1105" alt="Screenshot 2024-05-09 at 09 59 29" src="https://github.com/NathBabs/bitcoin-transaction-indexer/assets/17989552/fc4c72fb-12e9-4df8-8a43-93394aa57929">

### Data in RocksDB

<img width="1423" alt="Screenshot 2024-05-09 at 11 28 17" src="https://github.com/NathBabs/bitcoin-transaction-indexer/assets/17989552/16b59b06-c915-4c7a-b16c-75e0238b4354">

### Notifications received on webhook
<img width="1512" alt="Screenshot 2024-07-23 at 02 43 42" src="https://github.com/user-attachments/assets/2d265835-9552-4470-8792-9b3e89486946">

