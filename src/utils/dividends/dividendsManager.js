import DividendsPayment from "./dividends";
import { sendBch, SEND_BCH_ERRORS } from "../sendBch";
import Dividends from "./dividends";
import { getEncodedOpReturnMessage } from "./createDividends";

export default class DividendsManager {
  static async update({ wallet, utxos }) {
    try {
      const dividends = Object.values(DividendsPayment.getAll());
      const dividend = dividends.find(
        dividend => dividend.progress < 1 && dividend.status === Dividends.Status.RUNNING
      );
      if (dividend && utxos) {
        await DividendsManager.updateDividend({ wallet, dividend, utxos });
      }
    } catch (error) {
      console.info("Unable to update dividends", error.message);
    }
  }

  static async updateDividend({ wallet, dividend, utxos }) {
    try {
      const receivers = dividend.remainingReceivers.slice(0, Dividends.BATCH_SIZE);
      const quantities = dividend.remainingQuantities.slice(0, Dividends.BATCH_SIZE);
      const { encodedOpReturn } = getEncodedOpReturnMessage(
        dividend.opReturn,
        dividend.token.tokenId
      );

      const link = await sendBch(wallet, utxos, {
        addresses: receivers,
        values: quantities,
        encodedOpReturn
      });
      const tx = link.match(/([^/]+)$/)[1];
      dividend.txs.push(tx);
      dividend.remainingReceivers = dividend.remainingReceivers.slice(Dividends.BATCH_SIZE);
      dividend.remainingQuantities = dividend.remainingQuantities.slice(Dividends.BATCH_SIZE);
      dividend.progress = 1 - dividend.remainingReceivers.length / dividend.receiverCount;
      if (dividend.remainingQuantities.length === 0) {
        dividend.endDate = Date.now();
      }

      // avoid race conditions on status property
      const oldDividend = Dividends.get(dividend);
      if (
        oldDividend &&
        dividend.status === Dividends.Status.RUNNING &&
        dividend.status !== oldDividend.status
      ) {
        dividend.status = oldDividend.status;
      }
      Dividends.save(dividend);
    } catch (error) {
      if (
        error.code &&
        (error.code === SEND_BCH_ERRORS.DOUBLE_SPENDING ||
          error.code === SEND_BCH_ERRORS.NETWORK_ERROR)
      ) {
        return;
      }

      dividend.error = error.error || error.message;
      dividend.status = Dividends.Status.CRASHED;
      Dividends.save(dividend);
      console.info("Unable to update dividend", error.message);
    }
  }
}
