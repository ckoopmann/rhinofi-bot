#!/usr/bin/env node
const DVF = require('./dvf')
const { PRIVATE_KEY } = require('./config')

;(async () => {
  const dvf = await DVF({
   useStarkExV2: true
})

  await dvf.deposit('CUSDT', 1929523, PRIVATE_KEY.substring(2))
  console.log('Deposit OK, please wait a few minutes for the confirmations')
  process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
