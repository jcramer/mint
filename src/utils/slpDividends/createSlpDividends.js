import Big from "big.js";
import bitcore from "bitcore-lib-cash";
import withSLP from "../withSLP";
import { getEncodedOpReturnMessage } from "../dividends/createDividends";
import SlpDividends from "./slpDividends";

export const SLP_DIVIDEND_SATOSHIS_PER_BYTE = 1.01;

export const ESTIMATED_SATOSHIS_FEE_PER_BATCH = 1300;

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

    let estimatedTotalFee = new Big(0);

    // fan-out is required
    if (receivers.length > SlpDividends.FAN_OUT_BATCH_SIZE) {
      for (let i = 0; i < receivers.length; i += SlpDividends.FAN_OUT_BATCH_SIZE) {
        const fanoutQuantity = receivers
          .slice(i, i + SlpDividends.FAN_OUT_BATCH_SIZE)
          .reduce((p, c) => p.plus(new Big(c.quantity)), new Big(0));

        // fan-out fee per wallet
        let fee = new Big(0);
        for (let j = i; j <= i + SlpDividends.FAN_OUT_BATCH_SIZE; j += SlpDividends.BATCH_SIZE) {
          const receiversPerBatch = receivers.slice(j, j + SlpDividends.BATCH_SIZE);

          if (receiversPerBatch.length === 0) {
            break;
          }

          fee = fee
            .plus(SLP.BitcoinCash.toBitcoinCash(ESTIMATED_SATOSHIS_FEE_PER_BATCH))
            .plus(new Big(receiversPerBatch.length).mul(SLP.BitcoinCash.toBitcoinCash(546)));
          estimatedTotalFee = estimatedTotalFee.plus(fee);
        }

        const pk = new bitcore.PrivateKey();
        fanoutWallets.push({
          cashAddress: pk.toAddress().toString(),
          slpAddress: SLP.Address.toSLPAddress(pk.toAddress().toString()),
          wif: pk.toWIF(),
          quantity: fanoutQuantity.toFixed(sendingToken.info.decimals),
          lastReceiverIndex: i,
          prepared: false,
          completed: false,
          fundsRecovered: false,
          fee: fee.toFixed(8)
        });
      }

      // fan-out preparation fee
      for (let i = 0; i < fanoutWallets.length; i += SlpDividends.BATCH_SIZE) {
        const fanoutWalletSlice = fanoutWallets.slice(i, i + SlpDividends.BATCH_SIZE);
        const byteCount = SLP.BitcoinCash.getByteCount(
          { P2PKH: utxos.length },
          { P2PKH: fanoutWalletSlice.length + 3 }
        );
        estimatedTotalFee = estimatedTotalFee.plus(
          SLP.BitcoinCash.toBitcoinCash(Math.floor(SLP_DIVIDEND_SATOSHIS_PER_BYTE * byteCount))
        );
      }
    } else {
      for (let i = 0; i < receivers.length; i += SlpDividends.BATCH_SIZE) {
        const byteCount = SLP.BitcoinCash.getByteCount(
          { P2PKH: utxos.length },
          { P2PKH: receivers.slice(i, SlpDividends.BATCH_SIZE).length + 3 }
        );
        estimatedTotalFee = estimatedTotalFee.plus(
          SLP.BitcoinCash.toBitcoinCash(Math.floor(SLP_DIVIDEND_SATOSHIS_PER_BYTE * byteCount))
        );
      }
    }

    return {
      receivers,
      quantities,
      estimatedTotalFee,
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
