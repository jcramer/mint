import Big from "big.js";
import SlpDividends from "./slpDividends";
import withSLP from "../withSLP";

export default class SlpDividendsManager {
  static async update({ wallet, utxos }) {
    try {
      if (!utxos) {
        return;
      }

      const slpDividends = Object.values(SlpDividends.getAll());
      const preparingSlpDividend = slpDividends.find(
        slpDividend => slpDividend.status === SlpDividends.Status.PREPARING
      );
      if (preparingSlpDividend) {
        return await SlpDividendsManager.prepareSlpDividend({
          wallet,
          slpDividend: preparingSlpDividend,
          utxos
        });
      }
      const runningSlpDividendWithoutFanout = slpDividends.find(
        slpDividend =>
          slpDividend.progress < 1 &&
          slpDividend.status === SlpDividends.Status.RUNNING &&
          slpDividend.fanoutWallets.length === 0
      );
      if (runningSlpDividendWithoutFanout) {
        return await SlpDividendsManager.updateSlpDividend({
          wallet,
          slpDividend: runningSlpDividendWithoutFanout,
          utxos
        });
      }
    } catch (error) {
      console.info("Unable to update or prepare slpDividends", error.message);
    }
  }

  static prepareSlpDividend = withSLP(async (SLP, { wallet, slpDividend }) => {
    try {
      const unPreparedFanoutWallets = slpDividend.fanoutWallets
        .filter(wallet => !wallet.prepared)
        .slice(0, SlpDividends.BATCH_SIZE);

      const { Path245, Path145 } = wallet;
      const bchChangeReceiverAddress = Path145.cashAddress;
      const fundingWif = [Path245.fundingWif, Path145.fundingWif];
      const fundingAddress = [Path245.fundingAddress, Path145.fundingAddress];
      const tokenReceiverAddress = unPreparedFanoutWallets.map(wallet => wallet.slpAddress);

      const amount = unPreparedFanoutWallets.map(w =>
        new Big(w.quantity).toFixed(slpDividend.sendingToken.info.decimals)
      );

      const link = await SLP.TokenType1.send({
        fundingAddress,
        fundingWif,
        tokenReceiverAddress,
        bchChangeReceiverAddress,
        tokenId: slpDividend.sendingToken.tokenId,
        amount
      });

      const tx = link.match(/([^/]+)$/)[1];
      slpDividend.preparingTxs.push(tx);

      unPreparedFanoutWallets.forEach(w => {
        w.prepared = true;
      });
      if (slpDividend.fanoutWallets.every(w => w.prepared)) {
        slpDividend.status = SlpDividends.Status.RUNNING;
      }

      SlpDividends.save(slpDividend);
    } catch (error) {
      if (
        error.error &&
        (error.error.includes(SlpDividends.Errors.DOUBLE_SPENDING) ||
          error.error.includes(SlpDividends.Errors.TOO_MANY_UNCONFIRMED_ANCESTORS))
      ) {
        return;
      }

      console.info("Unable to prepare slpDividend", error.message);
    }
  });

  static updateSlpDividend = withSLP(async (SLP, { wallet, slpDividend, utxos }) => {
    try {
      const receivers = slpDividend.remainingReceivers.slice(0, SlpDividends.BATCH_SIZE);
      const addresses = receivers.map(receiver => receiver.address);
      const quantities = receivers.map(receiver => receiver.quantity);

      const { Path245, Path145 } = wallet;
      const bchChangeReceiverAddress = Path145.cashAddress;
      const fundingWif = [Path245.fundingWif, Path145.fundingWif];
      const fundingAddress = [Path245.fundingAddress, Path145.fundingAddress];
      const tokenReceiverAddress = addresses;

      const amount = quantities.map(quantity =>
        new Big(quantity).toFixed(slpDividend.sendingToken.info.decimals)
      );

      const link = await SLP.TokenType1.send({
        fundingAddress,
        fundingWif,
        tokenReceiverAddress,
        bchChangeReceiverAddress,
        tokenId: slpDividend.sendingToken.tokenId,
        amount
      });

      const tx = link.match(/([^/]+)$/)[1];
      slpDividend.txs.push(tx);
      slpDividend.remainingReceivers = slpDividend.remainingReceivers.slice(
        SlpDividends.BATCH_SIZE
      );
      slpDividend.progress = 1 - slpDividend.remainingReceivers.length / slpDividend.receiverCount;
      if (slpDividend.remainingReceivers.length === 0) {
        slpDividend.endDate = Date.now();
      }

      // avoid race conditions on status property
      delete slpDividend.status;

      SlpDividends.save(slpDividend);
    } catch (error) {
      if (
        error.error &&
        (error.error.includes(SlpDividends.Errors.DOUBLE_SPENDING) ||
          error.error.includes(SlpDividends.Errors.TOO_MANY_UNCONFIRMED_ANCESTORS))
      ) {
        return;
      }

      slpDividend.error = error.error || error.message;
      slpDividend.status = SlpDividends.Status.CRASHED;
      SlpDividends.save(slpDividend);
      console.info("Unable to update slpDividend", error.message || error);
    }
  });
}
