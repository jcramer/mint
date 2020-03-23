import Big from "big.js";
import chunk from "lodash/chunk";
import * as slpjs from "slpjs";
import SlpDividends from "./slpDividends";
import withSLP from "../withSLP";
import BigNumber from "bignumber.js";
import { sendBch } from "../sendBch";

export default class SlpDividendsManager {
  static async update({ wallet, slpBalancesAndUtxos }) {
    try {
      if (!slpBalancesAndUtxos || !slpBalancesAndUtxos.slpUtxos) {
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
          slpBalancesAndUtxos
        });
      }
      const runningSlpDividend = slpDividends.find(
        slpDividend => slpDividend.status === SlpDividends.Status.RUNNING
      );
      if (runningSlpDividend && runningSlpDividend.fanoutWallets.length === 0) {
        return await SlpDividendsManager.updateSlpDividend({
          wallet,
          slpDividend: runningSlpDividend
        });
      } else if (runningSlpDividend) {
        return await SlpDividendsManager.updateSlpDividendWithFanout({
          wallet,
          slpDividend: runningSlpDividend
        });
      }
    } catch (error) {
      console.error("Unable to update or prepare slpDividends due to: ", error.message);
    }
  }

  static prepareSlpDividend = withSLP(async (SLP, { wallet, slpDividend, slpBalancesAndUtxos }) => {
    try {
      const { Path245, Path145 } = wallet;
      const bchChangeReceiverAddress = Path145.cashAddress;
      const fundingWif = [Path245.fundingWif, Path145.fundingWif];
      const fundingAddress = [Path245.fundingAddress, Path145.fundingAddress];

      if (!slpDividend.fanoutFeePrepared) {
        const sendAmounts = slpDividend.fanoutWallets.map(w => w.fee);
        const addresses = slpDividend.fanoutWallets.map(w => w.cashAddress);
        const txid = await sendBch(wallet, slpBalancesAndUtxos.nonSlpUtxos, {
          addresses: addresses,
          values: sendAmounts
        });
        slpDividend.preparingTxs.push(txid.match(/([^/]+)$/)[1]);
        slpDividend.fanoutFeePrepared = true;
        SlpDividends.save(slpDividend);
        return;
      }

      if (!slpDividend.fanoutTokensPrepared) {
        const unPreparedFanoutWallets = slpDividend.fanoutWallets
          .filter(w => !w.prepared)
          .slice(0, SlpDividends.BATCH_SIZE);

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
          slpDividend.fanoutTokensPrepared = true;
        }

        SlpDividends.save(slpDividend);
      }

      const bitboxNetwork = new slpjs.BitboxNetwork(SLP);

      const fanoutWallets = slpDividend.fanoutWallets;
      const addressChunks = chunk(fanoutWallets.map(w => w.cashAddress), 20);

      const fanoutUtxos = (await Promise.all(
        addressChunks.map(addressChunk =>
          bitboxNetwork
            .getAllSlpBalancesAndUtxos(addressChunk)
            .catch(() => addressChunk.map(el => null))
            .then(balances => {
              if (balances) {
                return balances.map(balance => [
                  ...(balance.result.slpTokenUtxos[slpDividend.sendingToken.tokenId] || []),
                  ...balance.result.nonSlpUtxos
                ]);
              }
              return [];
            })
        )
      )).reduce((p, c) => p.concat(...c), []);

      if (fanoutUtxos.every(utxo => utxo.confirmations > 0)) {
        slpDividend.status = SlpDividends.Status.RUNNING;
        SlpDividends.save(slpDividend);
      }
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
      console.error("Unable to prepare slpDividend due to:", error.message);
    }
  });

  static updateSlpDividend = withSLP(async (SLP, { wallet, slpDividend }) => {
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

      // avoid race conditions not chaning the status property
      delete slpDividend.status;

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
        slpDividend.status = SlpDividends.Status.COMPLETED;
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

      slpDividend.error = error.error || error.message;
      slpDividend.status = SlpDividends.Status.CRASHED;
      SlpDividends.save(slpDividend);
      console.error("Unable to update slpDividend due to:", error.message || error);
    }
  });

  static updateSlpDividendWithFanout = withSLP(async (SLP, { wallet, slpDividend }) => {
    const bitboxNetwork = new slpjs.BitboxNetwork(SLP);

    const fanoutWallets = slpDividend.fanoutWallets;
    const addressChunks = chunk(fanoutWallets.map(w => w.cashAddress), 20);

    const fanoutUtxos = (await Promise.all(
      addressChunks.map(addressChunk =>
        bitboxNetwork
          .getAllSlpBalancesAndUtxos(addressChunk)
          .catch(() => addressChunk.map(el => null))
          .then(balances => {
            if (balances) {
              return balances.map(balance => [
                ...(balance.result.slpTokenUtxos[slpDividend.sendingToken.tokenId] || []),
                ...balance.result.nonSlpUtxos
              ]);
            }
            return [];
          })
      )
    )).reduce((p, c) => p.concat(c), []);

    // avoid race conditions not chaning the status property
    delete slpDividend.status;

    await Promise.all(
      fanoutWallets.map(async (fanoutWallet, i) => {
        const utxos = fanoutUtxos[i].map(utxo => ({ ...utxo, wif: fanoutWallet.wif }));
        if (utxos.length) {
          try {
            const receivers = slpDividend.remainingReceivers.slice(
              fanoutWallet.lastReceiverIndex,
              fanoutWallet.lastReceiverIndex + SlpDividends.BATCH_SIZE
            );
            const lastBatch =
              fanoutWallet.lastReceiverIndex + receivers.length >=
                (i + 1) * SlpDividends.FAN_OUT_BATCH_SIZE ||
              fanoutWallet.lastReceiverIndex + receivers.length >= slpDividend.receiverCount;
            const sendAmounts = receivers.map(receiver =>
              new BigNumber(receiver.quantity).times(10 ** slpDividend.sendingToken.info.decimals)
            );
            const tokenReceiverAddress = receivers.map(receiver => receiver.address);
            const bchChangeReceiverAddress = lastBatch
              ? wallet.Path145.slpAddress
              : fanoutWallet.slpAddress;

            const sendTxid = await bitboxNetwork.simpleTokenSend(
              slpDividend.sendingToken.tokenId,
              sendAmounts,
              utxos,
              tokenReceiverAddress,
              bchChangeReceiverAddress
            );

            slpDividend.progress += receivers.length / slpDividend.receiverCount;
            fanoutWallet.lastReceiverIndex += SlpDividends.BATCH_SIZE;
            slpDividend.txs.push(sendTxid);
            if (lastBatch) {
              fanoutWallet.completed = true;
            }

            if (slpDividend.fanoutWallets.every(w => w.completed)) {
              slpDividend.endDate = Date.now();
              slpDividend.status = SlpDividends.Status.COMPLETED;
            }

            SlpDividends.save(slpDividend);
          } catch (error) {
            console.error(
              "Unable to update slpDividend with fanout due to: ",
              error.message || error
            );
          }
        }
      })
    );
  });

  static recoverFunds = withSLP(async (SLP, { wallet, slpDividend }) => {
    const bitboxNetwork = new slpjs.BitboxNetwork(SLP);

    const fanoutWallets = slpDividend.fanoutWallets;
    const addressChunks = chunk(fanoutWallets.map(w => w.cashAddress), 20);

    const fanoutUtxos = (await Promise.all(
      addressChunks.map(addressChunk =>
        bitboxNetwork
          .getAllSlpBalancesAndUtxos(addressChunk)
          .catch(() => addressChunk.map(el => null))
          .then(balances => {
            if (balances) {
              return balances.map(balance => [
                ...(balance.result.slpTokenUtxos[slpDividend.sendingToken.tokenId] || []),
                ...balance.result.nonSlpUtxos
              ]);
            }
            return [];
          })
      )
    ))
      .reduce((p, c, i) => p.concat(...c), [])
      .map(utxo => ({
        ...utxo,
        wif: fanoutWallets.find(w => w.cashAddress === utxo.cashAddress).wif
      }));

    const tokenUtxos = fanoutUtxos.filter(utxo => utxo.slpUtxoJudgement === "SLP_TOKEN");
    const { Path245, Path145 } = wallet;
    const bchChangeReceiverAddress = Path145.slpAddress;
    const tokenReceiverAddress = Path245.slpAddress;

    if (tokenUtxos.length) {
      const sendAmounts = tokenUtxos.reduce(
        (p, utxo) => p.plus(new BigNumber(utxo.slpUtxoJudgementAmount)),
        new BigNumber(0)
      );

      await bitboxNetwork.simpleTokenSend(
        slpDividend.sendingToken.tokenId,
        sendAmounts,
        fanoutUtxos,
        tokenReceiverAddress,
        bchChangeReceiverAddress
      );
    }
  });
}
