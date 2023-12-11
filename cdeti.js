const DVF = require('./dvf')
const _ = require('lodash')
const { splitSymbol, prepareAmount, preparePrice } = require('dvf-utils')
const { PAIR, DTK } = require('./config')

let dvf

let lastBuyPrice
let lastSellPrice

onStartUp()

async function marketMake () {
  periodicReplace()
  setInterval(periodicReplace, 600000)
}

async function periodicReplace() {
    const [buyPrice, sellPrice] = await getOraclePrices()
    console.log('buyPrice', buyPrice, 'sellPrice', sellPrice)
    const haveOpenOrders = await checkIfOpenOrders()
    if (buyPrice !== lastBuyPrice || sellPrice !== lastSellPrice || !haveOpenOrders) {
      lastBuyPrice = buyPrice
      lastSellPrice = sellPrice
      replaceOrders()
    }
}

async function onStartUp () {
  dvf = await DVF()
  await syncBalances()
  console.log('Starting balances: ', balanceA, balanceB)
  marketMake()
}

// Trading Functions

let balanceA
let balanceB

async function cancelOpenOrders () {
  const orders = await dvf.getOrders()
  orders.forEach(o => {
    if (o.symbol != PAIR) return
    dvf.cancelOrder(o._id)
  })
}

async function checkIfOpenOrders () {
  const orders = await dvf.getOrders()
  return orders.length > 0
}

async function syncBalances () {
  const balances = _.chain(await dvf.getBalance())
    .keyBy('token')
    .mapValues('available')
    .value()
  
  const [quote, base] = splitSymbol(PAIR)
  balanceA = dvf.token.fromQuantizedAmount(quote, balances[quote])
  balanceB = dvf.token.fromQuantizedAmount(base, balances[base])
  balanceA = balanceA === 'NaN' ? 0 : balanceA
  balanceB = balanceB === 'NaN' ? 0 : balanceB
}

async function replaceOrders () {
  const [quote, base] = splitSymbol(PAIR)
  await cancelOpenOrders()
  setTimeout(async() => {
    await syncBalances()
    const balanceToSell = Math.abs(getAmountToTrade(balanceA, quote))
    placeOrder(-1 * balanceToSell)
    const balanceToBuy = getAmountToTrade(balanceB, base)
    placeOrder(balanceToBuy)
  }, 2000)
}

async function placeOrder (amount) {
  amount = 100 * Math.trunc(prepareAmount(amount, 0) / 100)
  if (amount === '0') return

  const [quote, base] = splitSymbol(PAIR)
  let price
  if (amount > 0) {
    price = preparePrice(lastBuyPrice)
    console.log('Place buy at:', price)
  } else {
    price = preparePrice(lastSellPrice)
    console.log('Place sell at:', price)
  }
  if (!price) return

  try {
    await dvf.submitOrder({
      symbol: PAIR,
      amount,
      price,
      starkPrivateKey: DTK
    })
  } catch (e) {
    const error = (e.error && e.error.details && e.error.details.error) || {}
    console.warn(`Trade not completed: ${error.error || error.message}`)
  }
}

/**
 * This is your function that provides buy and sell price
 * it should return an array with two values [buyPrice, sellPrice]
 */
async function getOraclePrices() {
  throw new Error('price oracle not implemented')

  return ['137.9999', '187.0001']
}

/**
 * This is your function that detemines the amount to put in order
 * takes two params: token and balance
 * should return a number, that is an amount to be placed in order
 * expressed in first token in pair i.e. CDETI for CDETI:ETH market
 */
function getAmountToTrade(balance, token) {
  throw new Error('amount calc not implemented')

  if (token === 'CDETI') {
    // full cdeti balance
    return balance
  }

  // full eth balance
  return balance * lastSellPrice
}