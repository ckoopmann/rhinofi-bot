const DVF = require("./dvf");
const _ = require("lodash");
const { splitSymbol, prepareAmount, preparePrice } = require("dvf-utils");
const { PAIR, PRIVATE_KEY, ALCHEMY_URL, ETHERSCAN_API_KEY } = require("./config");
const request = require("request-promise");

let dvf;

let lastMidPrice;

let tokenQuote;
let tokenBase;

onStartUp();

let pair, routeBuy, routeSell, buySide, sellSide, midPrice;
async function marketMake() {
    periodicReplace();
    setInterval(periodicReplace, 600000);
}

async function periodicReplace() {
    midPrice = await getOraclePrice();
    console.log(midPrice);
    const haveOpenOrders = await checkIfOpenOrders();
    if (midPrice !== lastMidPrice || !haveOpenOrders) {
        lastMidPrice = midPrice;
        replaceOrders();
    }
}

async function onStartUp() {
    dvf = await DVF();
    await syncBalances();
    console.log("Starting balances: ", balanceA, balanceB);
    marketMake();
}

// Trading Functions

let balanceA;
let balanceB;

async function cancelOpenOrders() {
    const orders = await dvf.getOrders();
    orders.forEach((o) => {
        if (o.symbol != PAIR) return;
        dvf.cancelOrder(o._id);
    });
}

async function checkIfOpenOrders() {
    const orders = await dvf.getOrders();
    return orders.length > 0;
}

async function syncBalances() {
    const balances = _.chain(await dvf.getBalance())
        .keyBy("token")
        .mapValues("available")
        .value();
    const [quote, base] = splitSymbol(PAIR);
    balanceA = dvf.token.fromQuantizedAmount(quote, balances[quote]);
    console.log("Balance A:", balanceA.toString());
    balanceB = dvf.token.fromQuantizedAmount(base, balances[base]);
    console.log("Balance B:", balanceB.toString());
    balanceA = balanceA === "NaN" ? 0 : balanceA;
    balanceB = balanceB === "NaN" ? 0 : balanceB;
}

async function replaceOrders() {
    await cancelOpenOrders();
    setTimeout(async () => {
        await syncBalances();
        const balanceToSell = Math.min(0.9 * balanceA, 500000 / lastMidPrice);
        console.log("Last mid price:", lastMidPrice);
        console.log("Balance to sell:", balanceToSell.toString());
        placeOrder(-1 * balanceToSell);
        const balanceToBuy = Math.min(
            (0.9 * balanceB) / lastMidPrice,
            500000 / lastMidPrice
        );
        console.log("Balance to buy:", balanceToBuy.toString());
        placeOrder(balanceToBuy);
    }, 2000);
}

async function placeOrder(amount) {
    console.log("Placing order for", amount);
    let preparedAmount = prepareAmount(amount, 5);
    console.log("Prepared amount:", preparedAmount);
    amount = preparedAmount;
    console.log("truncated amount", amount);
    if (amount === "0") return;

    const [quote, base] = splitSymbol(PAIR);
    let price;
    if (amount > 0) {
        price = preparePrice(lastMidPrice * 0.9995);
        console.log("Place buy at:", price);
    } else {
        price = preparePrice(lastMidPrice * 1.0005);
        console.log("Place sell at:", price);
    }
    if (!price) return;

    let order = {
        symbol: PAIR,
        amount,
        price,
        starkPrivateKey: PRIVATE_KEY.substring(2),
    };
    console.log("submitting order:", { symbol: PAIR, amount, price });

    try {
        await dvf.submitOrder(order);
    } catch (e) {
        const error =
            (e.error && e.error.details && e.error.details.error) || {};
        console.warn(`Trade not completed:`, e);
    }
}

let config, quote, base;
async function getOraclePrice() {
    if (!config) {
        [quote, base] = splitSymbol(PAIR);
        config = await dvf.getConfig();
    }

    const tokenContractAddress = config.tokenRegistry[quote].tokenAddress;

    const apiResponse = await request.get({
        url: `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`,
        json: true,
    });
    console.log("apiResponse: ", apiResponse);

    let price = apiResponse.result.ethusd;
    console.log("OraclePrice: ", price);
    return parseFloat(price).toPrecision(4);
}
