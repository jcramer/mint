import withSLP from "./withSLP";
import chunk from "lodash/chunk";
import { getUnconfirmedTxs, getAllConfirmedSlpTxs } from "./getTokenTransactionHistory";
import { isSlpTx } from "./decodeRawSlpTransactions";

const getLastTxDetails = withSLP(
  async (SLP, remainingNumberTxsDetails, confirmedBchTxids, lastSliceSize) => {
    const lastNtrancationIds = (M, N, transactionIds) => transactionIds.map(el => el.slice(M, N));
    const slicedTxids = lastNtrancationIds(
      lastSliceSize,
      lastSliceSize + remainingNumberTxsDetails,
      confirmedBchTxids
    );
    const concatenatedTxids = slicedTxids.reduce((a, b) => a.concat(b), []);
    const uniqueTxids = [...new Set(concatenatedTxids)];

    const revertChunk = chunkedArray =>
      chunkedArray.reduce((unchunkedArray, chunk) => [...unchunkedArray, ...chunk], []);

    const txidChunks = chunk(uniqueTxids, 20);
    const txidDetails = revertChunk(
      await Promise.all(txidChunks.map(txidChunk => SLP.Transaction.details(txidChunk)))
    );
    return txidDetails;
  }
);

export const isBchDividens = withSLP((SLP, vout) => {
  const scriptASMArray = SLP.Script.toASM(Buffer.from(vout[0].scriptPubKey.hex, "hex")).split(" ");
  const metaData =
    scriptASMArray.length > 1
      ? Buffer.from(scriptASMArray[1], "hex")
          .toString("ascii")
          .split(" ")
      : null;
  return scriptASMArray[0] === "OP_RETURN" &&
    metaData &&
    metaData[1] &&
    metaData[1].includes("MintDividend")
    ? decodeBchDividensMetaData(metaData)
    : false;
});

export const hasOpReturn = withSLP((SLP, vout) => {
  const scriptASMArray = SLP.Script.toASM(Buffer.from(vout[0].scriptPubKey.hex, "hex")).split(" ");

  return scriptASMArray[0] === "OP_RETURN";
});

const decodeBchDividensMetaData = metaData => {
  return {
    tokenId: metaData[0],
    message: metaData.length > 2 ? metaData.slice(2, metaData.length).join(" ") : ""
  };
};

const getTransactionHistory = async (SLP, cashAddresses, transactions, tokens) => {
  try {
    const calculateTransactionBalance = (vout, vin) => {
      const isDividends = isBchDividens(vout);
      if (isDividends) {
        if (
          vout.length > 2 &&
          cashAddresses.includes(
            SLP.Address.toCashAddress(vout[vout.length - 1].scriptPubKey.addresses[0])
          )
        ) {
          return {
            balance: (
              vout
                .slice(1, vout.length - 1)
                .map(element => +element.value * Math.pow(10, 8))
                .reduce((a, b) => a + b, 0) *
              Math.pow(10, -8) *
              -1
            ).toFixed(8),
            type: "MintDividend Sent",
            outputs: vout.slice(1, vout.length - 1).map(element => ({
              address: SLP.Address.toCashAddress(element.scriptPubKey.addresses[0]),
              amount: +element.value * -1
            })),

            metaData: isDividends
          };
        }

        if (
          vout.length > 2 &&
          vout
            .slice(1, vout.length - 1)
            .findIndex(element =>
              cashAddresses.includes(SLP.Address.toCashAddress(element.scriptPubKey.addresses[0]))
            ) !== -1
        ) {
          return {
            balance: (
              vout
                .slice(1, vout.length - 1)
                .filter(element =>
                  cashAddresses.includes(
                    SLP.Address.toCashAddress(element.scriptPubKey.addresses[0])
                  )
                )
                .map(el => +el.value * Math.pow(10, 8))
                .reduce((a, b) => a + b, 0) * Math.pow(10, -8)
            ).toFixed(8),
            type: "MintDividend Received",
            outputs: vout
              .slice(1, vout.length - 1)
              .filter(element =>
                cashAddresses.includes(SLP.Address.toCashAddress(element.scriptPubKey.addresses[0]))
              )
              .map(el => ({
                address: SLP.Address.toCashAddress(el.scriptPubKey.addresses[0]),
                amount: +el.value
              })),
            metaData: isDividends
          };
        }

        if (
          vout.length > 1 &&
          vout
            .slice(1, vout.length)
            .findIndex(element =>
              cashAddresses.includes(SLP.Address.toCashAddress(element.scriptPubKey.addresses[0]))
            ) === -1
        ) {
          return {
            balance: (
              vout
                .slice(1, vout.length)
                .map(el => +el.value * Math.pow(10, 8))
                .reduce((a, b) => a + b, 0) *
              Math.pow(10, -8) *
              -1
            ).toFixed(8),
            type: "MintDividend Sent",
            outputs: vout.slice(1, vout.length).map(el => ({
              address: SLP.Address.toCashAddress(el.scriptPubKey.addresses[0]),
              amount: +el.value * -1
            })),
            metaData: isDividends
          };
        }

        return {
          balance: null,
          type: "Unknown"
        };
      } else if (!hasOpReturn(vout)) {
        if (
          vout.length === 1 &&
          cashAddresses.includes(SLP.Address.toCashAddress(vout[0].scriptPubKey.addresses[0])) &&
          ((vin[0].addr &&
            vin.findIndex(
              input => !cashAddresses.includes(SLP.Address.toCashAddress(input.addr))
            ) === -1) ||
            (vin[0].legacyAddress &&
              vin.findIndex(
                input => !cashAddresses.includes(SLP.Address.toCashAddress(input.legacyAddress))
              ) === -1))
        ) {
          const previousBalance = vin
            .map(input => +(vin[0].valueSat ? input.valueSat : input.value))
            .filter(el => el > 546)
            .reduce((a, b) => +a + +b, 0);

          return {
            balance: (
              (+vout[0].value * Math.pow(10, 8) - previousBalance) *
              Math.pow(10, -8)
            ).toFixed(8),
            type: "Change Received"
          };
        }
        if (
          vout.length === 1 &&
          cashAddresses.includes(SLP.Address.toCashAddress(vout[0].scriptPubKey.addresses[0]))
        ) {
          return { balance: +vout[0].value, type: "Received" };
        }

        if (
          vout.length === 1 &&
          !cashAddresses.includes(SLP.Address.toCashAddress(vout[0].scriptPubKey.addresses[0]))
        ) {
          return { balance: +vout[0].value * -1, type: "Sent" };
        }

        if (
          vout.length > 1 &&
          cashAddresses.includes(
            SLP.Address.toCashAddress(vout[vout.length - 1].scriptPubKey.addresses[0])
          )
        ) {
          return {
            balance: (
              vout
                .slice(0, vout.length - 1)
                .map(element => +element.value * Math.pow(10, 8))
                .reduce((a, b) => a + b, 0) *
              Math.pow(10, -8) *
              -1
            ).toFixed(8),
            type: "Sent"
          };
        }

        if (
          vout.length > 1 &&
          vout
            .slice(0, vout.length - 1)
            .findIndex(element =>
              cashAddresses.includes(SLP.Address.toCashAddress(element.scriptPubKey.addresses[0]))
            ) !== -1
        ) {
          return {
            balance: (
              vout
                .slice(0, vout.length - 1)
                .filter(element =>
                  cashAddresses.includes(
                    SLP.Address.toCashAddress(element.scriptPubKey.addresses[0])
                  )
                )
                .map(el => +el.value * Math.pow(10, 8))
                .reduce((a, b) => a + b, 0) * Math.pow(10, -8)
            ).toFixed(8),
            type: "Received"
          };
        }

        if (
          vout.length > 1 &&
          vout.findIndex(element =>
            cashAddresses.includes(SLP.Address.toCashAddress(element.scriptPubKey.addresses[0]))
          ) === -1
        ) {
          return {
            balance: (
              vout.map(element => +element.value * Math.pow(10, 8)).reduce((a, b) => a + b, 0) *
              Math.pow(10, -8) *
              -1
            ).toFixed(8),
            type: "Sent"
          };
        }

        return {
          balance: null,
          type: "Unknown"
        };
      } else {
        return {
          balance: null,
          type: "Unknown"
        };
      }
    };

    const transactionHistory = {
      confirmed: [],
      unconfirmed: []
    };

    const slpAddresses = cashAddresses.map(addr => SLP.Address.toSLPAddress(addr));
    const nonZeroIndexes = transactions.reduce((a, e, i) => {
      if (e.length > 0) a.push(i);
      return a;
    }, []);

    const unconfirmedTxs = await getUnconfirmedTxs(slpAddresses);
    const unconfirmedSlpTxids = unconfirmedTxs.filter(tx => isSlpTx(tx)).map(tx => tx.txid);
    transactionHistory.unconfirmed = unconfirmedTxs
      .filter(tx => !isSlpTx(tx))
      .map(el => ({
        txid: el.txid,
        date: new Date(),
        confirmations: el.confirmations,
        transactionBalance: calculateTransactionBalance(el.vout, el.vin)
      }));

    const unconfirmedBchTxids = transactionHistory.unconfirmed.map(tx => tx.txid);

    const confirmedSlpTxs = await getAllConfirmedSlpTxs(slpAddresses, tokens);

    const concatenatedConfirmedSlpTxids = confirmedSlpTxs
      .map(txsByAddr => txsByAddr.map(tx => tx.txid))
      .reduce((a, b) => a.concat(b), []);
    const confirmedSlpTxids = [...new Set(concatenatedConfirmedSlpTxids)];
    const slpTxids = unconfirmedSlpTxids.concat(confirmedSlpTxids);

    let remainingNumberTxsDetails = 30 - transactionHistory.unconfirmed.length;

    if (remainingNumberTxsDetails > 0) {
      const confirmedBchTxids = Array.from({ length: nonZeroIndexes.length });
      nonZeroIndexes.forEach((e, i) => {
        confirmedBchTxids[i] = transactions[e].filter(
          el => !slpTxids.includes(el) && !unconfirmedBchTxids.includes(el)
        );
      });

      const txidDetails = await getLastTxDetails(remainingNumberTxsDetails, confirmedBchTxids, 0);

      const bchTxidDetails = txidDetails
        .filter(detail => !isSlpTx(detail))
        .slice(0, remainingNumberTxsDetails);

      while (
        Math.max(...confirmedBchTxids.map(txids => txids.length)) >
        29 - transactionHistory.unconfirmed.length
          ? bchTxidDetails.length < 30 - transactionHistory.unconfirmed.length
          : bchTxidDetails.length < Math.max(...confirmedBchTxids.map(txids => txids.length))
      ) {
        const diff = 30 - transactionHistory.unconfirmed.length - bchTxidDetails.length;
        const details = await getLastTxDetails(diff, confirmedBchTxids, remainingNumberTxsDetails);
        remainingNumberTxsDetails += diff;
        bchTxidDetails.concat(details.filter(detail => !isSlpTx(detail)));
        if (
          remainingNumberTxsDetails >
          Math.max(...confirmedBchTxids.map(txids => txids.length)) - 1
        )
          break;
      }

      transactionHistory.confirmed = bchTxidDetails
        .sort((x, y) => y.time - x.time)
        .map(el => ({
          txid: el.txid,
          date: new Date(el.time * 1000),
          confirmations: el.confirmations,
          transactionBalance: calculateTransactionBalance(el.vout, el.vin)
        }))
        .slice(0, 30 - transactionHistory.unconfirmed.length);
    }

    const { unconfirmed, confirmed } = transactionHistory;
    const history = unconfirmed.concat(confirmed);
    return {
      bchTransactions: history,
      wallets: nonZeroIndexes.map(el => cashAddresses[el])
    };
  } catch (e) {
    console.log("error :", e);
    return [];
  }
};

export default withSLP(getTransactionHistory);
