const DVF = require("./dvf");
const _ = require("lodash");
const { splitSymbol, prepareAmount, preparePrice } = require("dvf-utils");
const { DTK, ETHERSCAN_API_KEY } = require("./config");
const request = require("request-promise");

// Read pair config from first argument passed from commandline argument
const pairConfigPath = process.argv[2] ?? "./pair-example-config.json";
const pairConfig = require(pairConfigPath);
console.log("pairConfig", pairConfig);
checkPairConfig(pairConfig);

function checkPairConfig(pairConfig) {
    if (!pairConfig.pair) {
        throw new Error("pairConfig must have a pair property");
    }

    checkPair(pairConfig.pair);
    if (!pairConfig.updateFrequencyMs) {
        throw new Error("pairConfig must have a updateFrequencyMs property");
    }
    if (!pairConfig.relativeSpread) {
        throw new Error("pairConfig must have a relativeSpread property");
    }
    if (!pairConfig.balanceShareToUse) {
        throw new Error("pairConfig must have a balanceShareToUse property");
    }
    if (!pairConfig.retryIntervalMs) {
        throw new Error("pairConfig must have a retryIntervalMs property");
    }
}

function checkPair(pair) {
    const ALLOWED_QUOTE_TOKENS = ["CDETI"];
    const ALLOWED_BASE_TOKENS = ["ETH"];
    const [quoteToken, baseToken] = pair.split(":");
    if (!quoteToken || !baseToken) {
        throw new Error("pair must be in the format QUOTE:BASE");
    }
    if (!ALLOWED_QUOTE_TOKENS.includes(quoteToken)) {
        throw new Error(`quoteToken ${quoteToken} not allowed`);
    }
    if (!ALLOWED_BASE_TOKENS.includes(baseToken)) {
        throw new Error(`baseToken ${baseToken} not allowed`);
    }
}

let dvf;

let lastMidPrice;

let tokenQuote;
let tokenBase;
let replacementCount = 0;

onStartUp();

let pair, routeBuy, routeSell, buySide, sellSide, midPrice;
async function marketMake() {
    await cancelOpenOrders();
    while(true) {
        try {
            await periodicReplace();
            await sleep(pairConfig.updateFrequencyMs);
        } catch(e) {
            console.error("Error in periodic replace");
        }
    }
}

async function periodicReplace() {
    try {
        console.log("Replacement count: ", replacementCount++);
        midPrice = await getOraclePrice();
        console.log("Mid Price", midPrice);
        const haveOpenOrders = await checkIfOpenOrders();
        if (midPrice !== lastMidPrice || !haveOpenOrders) {
            lastMidPrice = midPrice;
            replaceOrders();
        } else {
            console.log("No replacement needed");
        }
    } catch (e) {
        console.error(
            "Error in period replacement - cancelling open orders",
            e.toString()
        );
        await cancelOpenOrders();
        throw e;
    }
}

async function onStartUp() {
    dvf = await DVF();

    await syncBalances();
    console.log("Starting balances: ", balanceA, balanceB);
    marketMake();
    process.on("SIGINT", cancelOpenOrdersAndQuit);
    process.on("SIGQUIT", cancelOpenOrdersAndQuit);
    process.on("SIGTERM", cancelOpenOrdersAndQuit);
}

async function cancelOpenOrdersAndQuit() {
    console.log("Cancelling open orders and quitting");
    await withRetry(cancelOpenOrders, "cancelOpenOrders", 20);
    console.log("Open orders cancelled");
    process.exit(0);
}

// Trading Functions

let balanceA;
let balanceB;

async function withRetry(
    fn,
    label = "anonymous function",
    retries = pairConfig.defaultRetries
) {
    try {
        return await fn();
    } catch (e) {
        if (retries > 0) {
            console.log(`Retrying ${label} retries left: ${retries}`);
            await sleep(pairConfig.retryIntervalMs);
            return await withRetry(fn, retries - 1);
        } else {
            throw e;
        }
    }
}
async function cancelOpenOrders() {
    const orders = await withRetry(dvf.getOrders, "getOrders");
    const promises = orders
        .filter((o) => o.symbol === pairConfig.pair)
        .map((o) => {
            return cancelOrder(o._id);
        });
    return Promise.all(promises);
}

async function cancelOrder(orderId) {
    console.log("Cancelling order: ", orderId);
    try {
        await withRetry(() => dvf.cancelOrder(orderId), "cancelOrder");
        console.log("Order cancelled: ", orderId);
    } catch (e) {
        console.error("Error cancelling order", e.toString());
    }
}

async function checkIfOpenOrders() {
    const orders = await withRetry(dvf.getOrders, "getOrders");
    return orders.length > 0;
}

async function syncBalances() {
    const balances = _.chain(await withRetry(dvf.getBalance, "getBalance"))
        .keyBy("token")
        .mapValues("available")
        .value();
    const [quote, base] = splitSymbol(pairConfig.pair);
    balanceA = dvf.token.fromQuantizedAmount(quote, balances[quote]);
    console.log("Balance A:", balanceA.toString());
    balanceB = dvf.token.fromQuantizedAmount(base, balances[base]);
    console.log("Balance B:", balanceB.toString());
    balanceA = balanceA === "NaN" ? 0 : balanceA;
    balanceB = balanceB === "NaN" ? 0 : balanceB;
}

async function replaceOrders() {
    await cancelOpenOrders();
    await sleep(2000);
    await syncBalances();
    const balanceToSell = Math.min(
        pairConfig.balanceShareToUse * balanceA,
        500000 / lastMidPrice
    );
    console.log("Last mid price:", lastMidPrice);
    console.log("Balance to sell:", balanceToSell.toString());
    const sellPromise = placeOrder(-1 * balanceToSell)
        .then(() => {
            console.log("Sell order placed");
        })
        .catch((e) => {
            console.error("Error placing sell order", e);
        });
    const balanceToBuy = Math.min(
        (pairConfig.balanceShareToUse * balanceB) / lastMidPrice,
        500000 / lastMidPrice
    );
    console.log("Balance to buy:", balanceToBuy.toString());
    const buyPromise = placeOrder(balanceToBuy)
        .then(() => {
            console.log("Buy order placed");
        })
        .catch((e) => {
            console.error("Error placing buy order", e);
        });

    await Promise.all([sellPromise, buyPromise]);
    console.log("Orders placed");
}

async function placeOrder(amount) {
    console.log("Placing order for", amount);
    let preparedAmount = prepareAmount(amount, 5);
    console.log("Prepared amount:", preparedAmount);
    amount = preparedAmount;
    console.log("truncated amount", amount);
    if (amount === "0") return;

    let price;
    if (amount > 0) {
        price = preparePrice(lastMidPrice * (1 - pairConfig.relativeSpread));
        console.log("Place buy at:", price);
    } else {
        price = preparePrice(lastMidPrice * (1 + pairConfig.relativeSpread));
        console.log("Place sell at:", price);
    }
    if (!price) return;

    let order = {
        symbol: pairConfig.pair,
        amount,
        price,
        starkPrivateKey: DTK,
    };
    console.log("submitting order:", { symbol: pairConfig.pair, amount, price });

    try {
        await withRetry(() => dvf.submitOrder(order), "submitOrder");
    } catch (e) {
        const error =
            (e.error && e.error.details && e.error.details.error) || {};
        console.warn(`Trade not completed:`, e);
    }
}

let config, quote, base;
async function getOraclePrice() {
    const [quote, base] = pairConfig.pair.split(":");
    config = await dvf.getConfig();

    const quotePricePromise = getQuotePrice(quote);
    if(base === "ETH") {
        const [ethPrice, quotePrice] = await Promise.all([
            getEthPrice(),
            quotePricePromise,
        ]);
        return quotePrice / ethPrice;
    }
    return quotePricePromise;
}

async function getQuotePrice(quote) {
    const url = `https://api.indexcoop.com/${quote.toLowerCase()}/nav`;
    console.log("quote price url: ", url);
    const apiResponse = await request.get({
        url,
        json: true,
    });
    console.log("index apiResponse: ", apiResponse);

    console.log("Oracle Quote USD Price: ", apiResponse.nav);
    return parseFloat(apiResponse.nav);
}
async function getEthPrice() {
    console.log("querying etherscan");
    const apiResponse = await request.get({
        url: `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`,
        json: true,
    });
    console.log("etherscan apiResponse: ", apiResponse);

    let price = apiResponse.result.ethusd;
    console.log("EthPrice: ", price);
    return parseFloat(price);
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
