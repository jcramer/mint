import SlpDividends from "./slpDividends";
import withSLP from "../withSLP";

export default class SlpDividendsManager {
  static async update({ wallet, utxos }) {
    try {
      const slpDividends = Object.values(SlpDividends.getAll());
      const slpDividend = slpDividends.find(
        slpDividend =>
          slpDividend.progress < 1 && slpDividend.status === SlpDividends.Status.IN_PROGRESS
      );
      if (slpDividend && utxos) {
        await SlpDividendsManager.updateSlpDividend({ wallet, slpDividend, utxos });
      }
    } catch (error) {
      console.info("Unable to update slpDividends", error.message);
    }
  }

  static updateSlpDividend = withSLP(async (SLP, { wallet, slpDividend, utxos }) => {
    try {
      const receivers = slpDividend.remainingReceivers.slice(0, SlpDividends.BATCH_SIZE);
      const quantities = slpDividend.remainingQuantities.slice(0, SlpDividends.BATCH_SIZE);

      const { Path245, Path145 } = wallet;
      const bchChangeReceiverAddress = Path145.cashAddress;
      const fundingWif = [Path245.fundingWif, Path145.fundingWif];
      const fundingAddress = [Path245.fundingAddress, Path145.fundingAddress];
      const tokenReceiverAddress = receivers;
      const amount = quantities.map(quantity => Number(quantity).toFixed(8));

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
      slpDividend.remainingQuantities = slpDividend.remainingQuantities.slice(
        SlpDividends.BATCH_SIZE
      );
      slpDividend.progress = 1 - slpDividend.remainingReceivers.length / slpDividend.receiverCount;
      if (slpDividend.remainingQuantities.length === 0) {
        slpDividend.endDate = Date.now();
      }
      SlpDividends.save(slpDividend);
    } catch (error) {
      if (
        error.error &&
        (error.error.includes(SlpDividends.ERRORS.DOUBLE_SPENDING) ||
          error.error.includes(SlpDividends.ERRORS.TOO_MANY_UNCONFIRMED_ANCESTORS))
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
