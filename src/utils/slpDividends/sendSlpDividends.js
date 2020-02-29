import Big from "big.js";
import withSLP from "../withSLP";
import { getEncodedOpReturnMessage, getBalancesForToken } from "../dividends/sendDividends";
import SlpDividends from "./slpDividends";

export const SLP_DIVIDEND_SATOSHIS_PER_BYTE = 1.01;

export const getEligibleSlpDividendReceivers = withSLP(
  (
    SLP,
    wallet,
    receiverTokenBalances,
    slpDividendQuantity,
    utxos,
    advancedOptions,
    sendingToken,
    receiverToken
  ) => {
    const eligibleSlpDividendReceivers = [];
    const slpDividendQuantities = [];

    const slpAddressesToExclude = advancedOptions.addressesToExclude
      .filter(addressToExclude => addressToExclude.valid)
      .map(addressToExclude => SLP.Address.toSLPAddress(addressToExclude.address));

    if (advancedOptions.ignoreOwnAddress) {
      slpAddressesToExclude.push(...wallet.slpAddresses);
    }

    const eligibleBalances = receiverTokenBalances
      .filter(balance => !slpAddressesToExclude.includes(balance.slpAddress))
      .map(eligibleBalance => ({
        ...eligibleBalance,
        tokenBalance: new Big(eligibleBalance.tokenBalanceString).div(
          Math.pow(10, -receiverToken.info.decimals)
        )
      }));

    const tokenBalanceSum = eligibleBalances.reduce((p, c) => p.plus(c.tokenBalance), new Big(0));
    let minimumReceiverBalance = tokenBalanceSum
      .mul(Math.pow(10, -sendingToken.info.decimals))
      .div(slpDividendQuantity);

    const filteredEligibleBalances = eligibleBalances.filter(eligibleBalance =>
      minimumReceiverBalance.lte(eligibleBalance.tokenBalance)
    );
    const filteredTokenBalanceSum = filteredEligibleBalances.reduce(
      (p, c) => p.plus(c.tokenBalance),
      new Big(0)
    );

    filteredEligibleBalances.forEach(async eligibleBalance => {
      const eligibleQuantity = eligibleBalance.tokenBalance
        .div(filteredTokenBalanceSum)
        .mul(slpDividendQuantity);
      slpDividendQuantities.push(eligibleQuantity);
      eligibleSlpDividendReceivers.push(eligibleBalance.slpAddress);
    });

    const { encodedOpReturn, decodedOpReturn } = getEncodedOpReturnMessage(
      advancedOptions.opReturnMessage,
      sendingToken.tokenId
    );

    let txFee = 0;

    const requiredUtxosLength = Math.ceil(
      eligibleSlpDividendReceivers.length,
      SlpDividends.BATCH_SIZE
    );
    const currentUtxosLength = utxos.filter(
      utxo => utxo.slpData && utxo.slpData.tokenId === sendingToken.tokenId
    ).length;

    // fan-out is required
    if (requiredUtxosLength > currentUtxosLength) {
      for (let i = 0; i < requiredUtxosLength; i += 1) {
        const byteCount = SLP.BitcoinCash.getByteCount({ P2PKH: utxos.length + 1 }, { P2PKH: 3 });
        txFee += SLP.BitcoinCash.toBitcoinCash(
          Math.floor(SLP_DIVIDEND_SATOSHIS_PER_BYTE * byteCount).toFixed(8)
        );
      }
    }

    for (let i = 0; i < eligibleSlpDividendReceivers.length; i += SlpDividends.BATCH_SIZE) {
      const byteCount = SLP.BitcoinCash.getByteCount(
        { P2PKH: utxos.length + 1 },
        { P2PKH: eligibleSlpDividendReceivers.slice(i, SlpDividends.BATCH_SIZE).length + 3 }
      );
      txFee += SLP.BitcoinCash.toBitcoinCash(
        Math.floor(SLP_DIVIDEND_SATOSHIS_PER_BYTE * byteCount).toFixed(8)
      );
    }

    return {
      eligibleSlpDividendReceivers,
      slpDividendQuantities,
      txFee,
      encodedOpReturn,
      decodedOpReturn
    };
  }
);

export const sendSlpDividends = async (
  wallet,
  utxos,
  advancedOptions,
  { slpDividendQuantity, sendingToken, receiverToken }
) => {
  const receiverTokenBalances = await getBalancesForToken(receiverToken.tokenId);

  const { eligibleSlpDividendReceivers, slpDividendQuantities } = getEligibleSlpDividendReceivers(
    wallet,
    receiverTokenBalances,
    slpDividendQuantity,
    utxos,
    advancedOptions,
    sendingToken,
    receiverToken
  );

  const dividend = new SlpDividends({
    sendingToken,
    receiverToken,
    eligibleSlpDividendReceivers,
    slpDividendQuantity,
    slpDividendQuantities,
    opReturn: advancedOptions.opReturnMessage
  });

  SlpDividends.save(dividend);
};
