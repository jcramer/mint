import Big from "big.js";
import withSLP from "../withSLP";
import { SATOSHIS_PER_BYTE, DUST } from "../sendBch";
import Dividends from "./dividends";

export const getEncodedOpReturnMessage = withSLP((SLP, opReturnMessage = "", tokenId) => {
  const decodedOpReturn = `${tokenId} MintDividend${opReturnMessage ? `: ${opReturnMessage}` : ""}`;
  const buf = Buffer.from(decodedOpReturn, "ascii");
  return {
    encodedOpReturn: SLP.Script.encodeNullDataOutput(buf),
    decodedOpReturn
  };
});

export const getBalancesForToken = withSLP(async (SLP, tokenId) => {
  try {
    const balances = await SLP.Utils.balancesForToken(tokenId);
    balances.totalBalance = balances.reduce((p, c) => c.tokenBalance + p, 0);
    return balances;
  } catch (err) {
    console.error(`Error in getTokenInfo: `, err);
    throw err;
  }
});

export const getEligibleAddresses = withSLP(
  (SLP, wallet, balancesForToken, value, utxos, advancedOptions, tokenId) => {
    const addresses = [];
    const values = [];

    const slpAddressesToExclude = advancedOptions.addressesToExclude
      .filter(addressToExclude => addressToExclude.valid)
      .map(addressToExclude => SLP.Address.toSLPAddress(addressToExclude.address));

    if (advancedOptions.ignoreOwnAddress) {
      slpAddressesToExclude.push(...wallet.slpAddresses);
    }

    const eligibleBalances = balancesForToken
      .filter(balance => !slpAddressesToExclude.includes(balance.slpAddress))
      .map(eligibleBalance => ({
        ...eligibleBalance,
        tokenBalance: new Big(eligibleBalance.tokenBalanceString)
      }));
    const tokenBalanceSum = eligibleBalances.reduce((p, c) => p.plus(c.tokenBalance), new Big(0));
    const minTokenBalance = tokenBalanceSum.mul(DUST).div(value);

    const filteredEligibleBalances = eligibleBalances.filter(eligibleBalance =>
      minTokenBalance.lte(eligibleBalance.tokenBalance)
    );
    const filteredTokenBalanceSum = filteredEligibleBalances.reduce(
      (p, c) => p.plus(c.tokenBalance),
      new Big(0)
    );
    filteredEligibleBalances.forEach(async eligibleBalance => {
      const eligibleValue = eligibleBalance.tokenBalance.div(filteredTokenBalanceSum).mul(value);
      values.push(eligibleValue);
      addresses.push(eligibleBalance.slpAddress);
    });
    const { encodedOpReturn, decodedOpReturn } = getEncodedOpReturnMessage(
      advancedOptions.opReturnMessage,
      tokenId
    );
    let txFee = 0;
    for (let i = 0; i < addresses.length; i += Dividends.BATCH_SIZE) {
      const byteCount = SLP.BitcoinCash.getByteCount(
        { P2PKH: utxos.length },
        { P2PKH: addresses.slice(i, Dividends.BATCH_SIZE).length + 2 }
      );
      txFee += SLP.BitcoinCash.toBitcoinCash(
        Math.floor(SATOSHIS_PER_BYTE * (byteCount + encodedOpReturn.length)).toFixed(8)
      );
    }

    return {
      addresses,
      values,
      txFee,
      encodedOpReturn,
      decodedOpReturn
    };
  }
);

export const createDividends = async (wallet, utxos, advancedOptions, { value, token }) => {
  const outputs = await getBalancesForToken(token.tokenId);

  const { addresses, values } = getEligibleAddresses(
    wallet,
    outputs,
    value,
    utxos,
    advancedOptions,
    token.tokenId
  );

  const dividend = new Dividends({
    token,
    eligibleDividendReceivers: addresses,
    dividendQuantity: value,
    dividendQuantities: values,
    opReturn: advancedOptions.opReturnMessage
  });

  Dividends.save(dividend);
};
