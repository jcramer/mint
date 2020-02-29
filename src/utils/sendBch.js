import Big from "big.js";
import withSLP from "./withSLP";

export const DUST = 0.00005;
export const SATOSHIS_PER_BYTE = 1.01;
export const SEND_BCH_ERRORS = {
  INSUFICIENT_FUNDS: "custom code 0",
  NETWORK_ERROR: "custom code 1",
  INSUFFICIENT_PRIORITY: "code 66", // ~insufficien fee
  DOUBLE_SPENDING: "code 18",
  MAX_UNCONFIRMED_TXS: "code 64"
};
const NETWORK = process.env.REACT_APP_NETWORK;

export const sendBch = withSLP(
  async (SLP, wallet, utxos, { addresses, values, encodedOpReturn }) => {
    try {
      if (!values.length) {
        return null;
      }

      const value = values.reduce(
        (previous, current) => new Big(current).plus(previous),
        new Big(0)
      );
      const REMAINDER_ADDR = wallet.Path145.cashAddress;

      const inputUtxos = [];
      let transactionBuilder;

      // instance of transaction builder
      if (NETWORK === `mainnet`) transactionBuilder = new SLP.TransactionBuilder();
      else transactionBuilder = new SLP.TransactionBuilder("testnet");

      const satoshisToSend = SLP.BitcoinCash.toSatoshi(value.toFixed(8));
      let originalAmount = new Big(0);
      let txFee = 0;
      for (let i = 0; i < utxos.length; i++) {
        const utxo = utxos[i];
        originalAmount = originalAmount.plus(utxo.satoshis);
        const vout = utxo.vout;
        const txid = utxo.txid;
        // add input with txid and index of vout
        transactionBuilder.addInput(txid, vout);
        inputUtxos.push(utxo);

        const byteCount = encodedOpReturn
          ? SLP.BitcoinCash.getByteCount(
              { P2PKH: inputUtxos.length },
              { P2PKH: addresses.length + 2 }
            )
          : SLP.BitcoinCash.getByteCount(
              { P2PKH: inputUtxos.length },
              { P2PKH: addresses.length + 1 }
            );
        const satoshisPerByte = SATOSHIS_PER_BYTE;
        txFee = encodedOpReturn
          ? Math.floor(satoshisPerByte * (byteCount + encodedOpReturn.length))
          : Math.floor(satoshisPerByte * byteCount);

        if (
          originalAmount
            .minus(satoshisToSend)
            .minus(txFee)
            .gte(0)
        ) {
          break;
        }
      }

      // amount to send back to the remainder address.
      const remainder = Math.floor(originalAmount.minus(satoshisToSend).minus(txFee));
      if (remainder < 0) {
        const error = new Error(`Insufficient funds`);
        error.code = SEND_BCH_ERRORS.INSUFICIENT_FUNDS;
        throw error;
      }

      if (encodedOpReturn) {
        transactionBuilder.addOutput(encodedOpReturn, 0);
      }

      // add output w/ address and amount to send
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        transactionBuilder.addOutput(
          SLP.Address.toCashAddress(address),
          SLP.BitcoinCash.toSatoshi(Number(values[i]).toFixed(8))
        );
      }

      if (remainder >= SLP.BitcoinCash.toSatoshi(DUST)) {
        transactionBuilder.addOutput(REMAINDER_ADDR, remainder);
      }

      // Sign the transactions with the HD node.
      for (let i = 0; i < inputUtxos.length; i++) {
        const utxo = inputUtxos[i];
        transactionBuilder.sign(
          i,
          SLP.ECPair.fromWIF(utxo.wif),
          undefined,
          transactionBuilder.hashTypes.SIGHASH_ALL,
          utxo.satoshis
        );
      }

      // build tx
      const tx = transactionBuilder.build();
      // output rawhex
      const hex = tx.toHex();

      // Broadcast transation to the network
      const txidStr = await SLP.RawTransactions.sendRawTransaction([hex]);
      let link;
      if (NETWORK === `mainnet`) {
        link = `https://explorer.bitcoin.com/bch/tx/${txidStr}`;
      } else {
        link = `https://explorer.bitcoin.com/tbch/tx/${txidStr}`;
      }
      console.log(link);

      return link;
    } catch (err) {
      if (err && err.err.includes(SEND_BCH_ERRORS.INSUFFICIENT_PRIORITY)) {
        err.code = SEND_BCH_ERRORS.INSUFFICIENT_PRIORITY;
      } else if (err && err.err.includes(SEND_BCH_ERRORS.DOUBLE_SPENDING)) {
        err.code = SEND_BCH_ERRORS.DOUBLE_SPENDING;
      } else if (err.err === "Network Error") {
        err.code = SEND_BCH_ERRORS.NETWORK_ERROR;
      } else if (err && err.err.includes(SEND_BCH_ERRORS.MAX_UNCONFIRMED_TXS)) {
        err.code = SEND_BCH_ERRORS.MAX_UNCONFIRMED_TXS;
      }
      console.log(`error: `, err);
      throw err;
    }
  }
);

export const calcFee = withSLP((SLP, utxos) => {
  const byteCount = SLP.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: 2 });
  const satoshisPerByte = SATOSHIS_PER_BYTE;
  const txFee = SLP.BitcoinCash.toBitcoinCash(Math.floor(satoshisPerByte * byteCount));
  return txFee;
});
