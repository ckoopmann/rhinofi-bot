#!/usr/bin/env node
const DVF = require("./dvf");
const { DTK } = require("./config");

(async () => {
    const dvf = await DVF({
        useStarkExV2: true,
    });

    const depositToken = process.argv[2];
    if (!depositToken) {
        console.log("Please specify a token to deposit as first argument");
        process.exit(1);
    }
    const depositAmount = parseFloat(process.argv[3]);
    if (!depositAmount > 0) {
        console.log(
            "Please specify a positive amount to deposit as second argument"
        );
        process.exit(1);
    }
    console.log("Depositing", { depositAmount, depositToken });
    await dvf.deposit(depositToken, depositAmount, DTK);
    console.log("Deposit OK, please wait a few minutes for the confirmations");
    process.exit(1);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
