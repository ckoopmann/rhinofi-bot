# Yield Bot: A simple bot providing liquidity around a price oracle (for example based on Compound, Aave, or staking etc)

This simple Node.js bot is for [rhino.fi](rhino.fi). This bot aims to simply keep one large sell ordre and one large buy order on any specified market, at prices determined by an oracle.

### Steps to use:

1. Create a new Ethereum account and fund with ETH and token to deposit
2. `git clone https://github.com/rhinofi/yield-bot.git`
2. Copy `config.example.js` => `config.js`
3. Get an Alchemy URL and enter use it to populate the config file: [here](https://github.com/rhinofi/yield-bot/blob/cdeti/config.example.js#L5)
4. Enter your Ethereum private key here (prefixed with 0x): [here](https://github.com/rhinofi/yield-bot/blob/cdeti/config.example.js#L3)
5. Enter your decrypted stark trading key here: [here](https://github.com/rhinofi/yield-bot/blob/cdeti/config.example.js#L4)
6. Choose the market pair you want to trade and update it [here](https://github.com/rhinofi/yield-bot/blob/cdeti/config.example.js#L5)
7. Enter the token to deposit [here](https://github.com/rhinofi/yield-bot/blob/cdeti/config.example.js#L7)
8. Enter the amount to deposit [here](https://github.com/rhinofi/yield-bot/blob/cdeti/config.example.js#L8)
9. Implement the price fetching oracle that returns buy and sell price [here](https://github.com/rhinofi/yield-bot/blob/cdeti/cdeti.js#L111)
10. Implement the function to provide order amount based on balance [here](https://github.com/rhinofi/yield-bot/blob/cdeti/cdeti.js#L123)

Once the above setup is complete, you can use the following instructions:

`npm install`

`node setup` - registers and deposits your token to the exchange

`node cdeti` - starts the bot!

### Example:

This example uses an API provided by compound to give the price.

In production we are using this for the following markets:
- CUSDT:USDT
- DVF:xDVF

Both of these are run by the account: 0xbBD430c6FD183331B35Ee4Fd3BFcA7cB6437C6e4

Please fork and use!
