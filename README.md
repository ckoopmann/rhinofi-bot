# Yield Bot: A simple bot providing liquidity around a price oracle (for example based on Compound, Aave, or staking etc)

This simple Node.js bot is for [DeversiFi](deversifi.com). This bot aims to simply keep one large sell ordre and one large buy order on any specified market, at prices determined by an oracle.

### Steps to use:

1. Create a new Ethereum account and fund with ETH
2. `git clone https://github.com/DeversiFi/yield-bot.git`
2. Copy `config.example.js` => `config.js`
3. Get an Alchemy URL and enter use it to populate the config file: [here](https://github.com/DeversiFi/yield-bot/blob/main/config.example.js#L5)
4. Enter your Ethereum private key here (prefixed with 0x): [here](https://github.com/DeversiFi/yield-bot/blob/main/config.example.js#L3)
5. Choose the market pair you want to trade and update it [here](https://github.com/DeversiFi/yield-bot/blob/main/config.example.js#L4)

Once the above setup is complete, you can use the following instructions:

`npm install`

`node setup` - registers and deposits your ETH to the exchange

`node index` - starts the bot!

### Example:

This example uses an API provided by compound to give the price.


Please fork and use!
