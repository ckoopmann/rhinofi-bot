#!/usr/bin/env node
const DVF = require('./dvf')
const { DEPOSIT_TOKEN, DEPOSIT_AMOUNT, DTK } = require('./config')

;(async () => {
  const dvf = await DVF({
    useStarkExV2: true
})

  await dvf.deposit(DEPOSIT_TOKEN, DEPOSIT_AMOUNT, DTK)
  console.log('Deposit OK, please wait a few minutes for the confirmations')
  process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
