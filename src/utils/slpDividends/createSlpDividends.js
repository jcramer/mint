import Big from "big.js";
import bitcore from "bitcore-lib-cash";
import withSLP from "../withSLP";
import { getEncodedOpReturnMessage } from "../dividends/createDividends";
import SlpDividends from "./slpDividends";

export const SLP_DIVIDEND_SATOSHIS_PER_BYTE = 1.01;

export const getEligibleSlpDividendReceivers = withSLP(
  (
    SLP,
    wallet,
    receiverBalancesForToken,
    quantity,
    utxos,
    advancedOptions,
    sendingToken,
    receiverToken
  ) => {
    const SATOSHIS_PER_SENDING_TOKEN = new Big(10).pow(sendingToken.info.decimals);
    const SATOSHIS_PER_RECEIVER_TOKEN = new Big(10).pow(receiverToken.info.decimals);
    const receivers = [];
    const quantities = [];
    const satoshisQuantity = new Big(quantity).mul(SATOSHIS_PER_SENDING_TOKEN);
    let remainingSatoshisQuantity = new Big(satoshisQuantity);
    const fanoutWallets = [];

    const sortedReceiverTokenBalances = receiverBalancesForToken.sort((a, b) =>
      a.tokenBalance > b.tokenBalance ? -1 : 1
    );

    const addressesToExclude = advancedOptions.addressesToExclude
      .filter(addressToExclude => addressToExclude.valid)
      .map(addressToExclude => SLP.Address.toSLPAddress(addressToExclude.address));

    if (advancedOptions.ignoreOwnAddress) {
      addressesToExclude.push(...wallet.slpAddresses);
    }

    const eligibleBalances = sortedReceiverTokenBalances
      .filter(balance => !addressesToExclude.includes(balance.slpAddress))
      .map(eligibleBalance => ({
        ...eligibleBalance,
        tokenBalance: new Big(eligibleBalance.tokenBalanceString).mul(SATOSHIS_PER_RECEIVER_TOKEN)
      }));

    const tokenBalanceSum = eligibleBalances.reduce((p, c) => p.plus(c.tokenBalance), new Big(0));
    let minimumReceiverBalance = tokenBalanceSum.div(satoshisQuantity);

    const filteredEligibleBalances = eligibleBalances.filter(eligibleBalance =>
      minimumReceiverBalance.lte(eligibleBalance.tokenBalance)
    );

    const filteredTokenBalanceSum = filteredEligibleBalances.reduce(
      (p, c) => p.plus(c.tokenBalance),
      new Big(0)
    );

    for (let i = 0; i < filteredEligibleBalances.length; i++) {
      const eligibleBalance = filteredEligibleBalances[i];
      let eligibleSatoshisQuantity = new Big(
        Math.floor(eligibleBalance.tokenBalance.div(filteredTokenBalanceSum).mul(satoshisQuantity))
      );
      if (remainingSatoshisQuantity.minus(eligibleSatoshisQuantity).lt(1)) {
        eligibleSatoshisQuantity = remainingSatoshisQuantity;
        remainingSatoshisQuantity = new Big(0);
      } else {
        remainingSatoshisQuantity = remainingSatoshisQuantity.minus(eligibleSatoshisQuantity);
      }
      const eligibleQuantity = new Big(eligibleSatoshisQuantity).div(SATOSHIS_PER_SENDING_TOKEN);
      receivers.push({
        address: eligibleBalance.slpAddress,
        quantity: Number(eligibleQuantity.toFixed(sendingToken.info.decimals))
      });

      if (remainingSatoshisQuantity.eq(0)) {
        break;
      }
    }

    const { encodedOpReturn, decodedOpReturn } = getEncodedOpReturnMessage(
      advancedOptions.opReturnMessage,
      sendingToken.tokenId
    );

    let txFee = 0;

    const sendingTokenUtxos = utxos.filter(
      utxo => utxo.slpData && utxo.slpData.tokenId === sendingToken.tokenId
    );

    // fan-out is required
    if (receivers.length > SlpDividends.FAN_OUT_BATCH_SIZE) {
      for (let i = 0; i < receivers.length; i += SlpDividends.FAN_OUT_BATCH_SIZE) {
        const quantities = receivers
          .slice(i, i + SlpDividends.FAN_OUT_BATCH_SIZE)
          .reduce((p, c) => p.plus(new Big(c.quantity)), new Big(0));

        const pk = new bitcore.PrivateKey();
        fanoutWallets.push({
          cashAddress: pk.toAddress().toString(),
          slpAddress: SLP.Address.toSLPAddress(pk.toAddress().toString()),
          wif: pk.toWIF(),
          quantity: quantities.toFixed(sendingToken.info.decimals),
          lastReceiverIndex: i,
          prepared: false
        });
      }

      for (let i = 0; i < fanoutWallets.length; i += SlpDividends.BATCH_SIZE) {
        const fanoutWalletSlice = fanoutWallets.slice(i, i + SlpDividends.BATCH_SIZE);
        const byteCount = SLP.BitcoinCash.getByteCount(
          { P2PKH: sendingTokenUtxos.length + 1 },
          { P2PKH: fanoutWalletSlice.length + 3 }
        );
        txFee += SLP.BitcoinCash.toBitcoinCash(
          Math.floor(SLP_DIVIDEND_SATOSHIS_PER_BYTE * byteCount).toFixed(8)
        );
      }
    }

    for (let i = 0; i < receivers.length; i += SlpDividends.BATCH_SIZE) {
      const byteCount = SLP.BitcoinCash.getByteCount(
        { P2PKH: 2 }, // token utxo + bch utxo,
        { P2PKH: receivers.slice(i, SlpDividends.BATCH_SIZE).length + 3 }
      );
      txFee += SLP.BitcoinCash.toBitcoinCash(
        Math.floor(SLP_DIVIDEND_SATOSHIS_PER_BYTE * byteCount).toFixed(8)
      );
    }

    return {
      receivers,
      quantities,
      txFee,
      encodedOpReturn,
      decodedOpReturn,
      remainingQuantity: new Big(remainingSatoshisQuantity).div(SATOSHIS_PER_SENDING_TOKEN),
      fanoutWallets
    };
  }
);

export const createSlpDividends = async (
  wallet,
  tokenBalances,
  utxos,
  advancedOptions,
  { quantity, sendingToken, receiverToken }
) => {
  const { receivers, fanoutWallets } = getEligibleSlpDividendReceivers(
    wallet,
    tokenBalances,
    quantity,
    utxos,
    advancedOptions,
    sendingToken,
    receiverToken
  );

  if (receivers.length === 0) {
    const noEligibleReceiversError = new Error("No eligible receiver");
    noEligibleReceiversError.code = SlpDividends.Errors.NO_ELIGIBLE_RECEIVERS;
    throw noEligibleReceiversError;
  }

  const slpDividend = new SlpDividends({
    sendingToken,
    receiverToken,
    receivers,
    quantity,
    fanoutWallets,
    opReturn: advancedOptions.opReturnMessage
  });

  SlpDividends.save(slpDividend);
};
