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
