import withSLP from "./withSLP";
import chunk from "lodash/chunk";
import { decodeRawSlpTrasactionsByTxs } from "./decodeRawSlpTransactions";

export const getUnconfirmedTxs = withSLP(async (SLP, slpAddresses) => {
  const lastTransactions = await SLP.Address.transactions(slpAddresses);

  const goToNextPage = transactions => {
    const confirmedTxs = transactions.map(transactionsByAddress =>
      transactionsByAddress.txs.filter(tx => tx.confirmations !== 0)
    );
    return Math.min(...confirmedTxs.map(txs => txs.length)) === 0;
  };

  const concatenatedUniqueUnconfirmedTransactions = transactions =>
    Object.values(
      transactions
        .map(transactionsByAddress =>
          transactionsByAddress.txs.filter(tx => tx.confirmations === 0)
        )
        .reduce((a, b) => a.concat(b), [])
        .reduce((acc, cur) => ({ ...acc, ...{ [cur.txid]: cur } }), {})
    );

  const unconfirmedTxs = concatenatedUniqueUnconfirmedTransactions(lastTransactions);
  if (goToNextPage(lastTransactions)) {
    const numerOfPages = Math.max(...lastTransactions.map(transaction => transaction.pagesTotal));
    for (let page = 1; page < numerOfPages; page++) {
      const txsOnPage = await SLP.Address.transactions(slpAddresses, page);
      unconfirmedTxs.concat(concatenatedUniqueUnconfirmedTransactions(txsOnPage));
      if (!goToNextPage(txsOnPage)) break;
    }
  }
  return unconfirmedTxs;
});

export const getConfirmedSlpTxsByTokenId = withSLP(async (SLP, slpAddresses, tokenId) => {
  const transactions = await SLP.Utils.bulkTransactions(
    slpAddresses.map(address => ({ tokenId, address }))
  );
  return transactions;
});

export const getAllConfirmedSlpTxs = withSLP(async (SLP, slpAddresses, tokens) => {
  const transactions = await SLP.Utils.bulkTransactions(
    tokens
      .map(token => slpAddresses.map(address => ({ tokenId: token.tokenId, address })))
      .reduce((a, b) => a.concat(b), [])
  );
  return transactions;
});

const insert = (arr, index, newItem) => [...arr.slice(0, index), newItem, ...arr.slice(index)];

const mockedBurnAll = txid => ({
  txid,
  detail: { transactionType: "BURN_ALL" },
  vin: null,
  vout: null,
  balance: null,
  confirmations: null,
  date: null,
  time: null
});

const mockedArrayBurnAll = txid => [
  {
    txid,
    detail: { transactionType: "BURN_ALL" },
    vin: null,
    vout: null,
    balance: null,
    confirmations: null,
    date: null,
    time: null
  }
];

const getTokenTransactionHistory = async (SLP, slpAddresses, tokenInfo, tokenUtxos) => {
  try {
    const { tokenId } = tokenInfo;

    const Xor = (x, y) => (x || y) && !(x && y);

    const calculateTransactionBalance = outputs => {
      if (outputs.length === 1 && slpAddresses.includes(outputs[0].address))
        return +outputs[0].amount;
      if (outputs.length === 1 && !slpAddresses.includes(outputs[0].address))
        return +outputs[0].amount * -1;
      if (outputs.length > 1 && slpAddresses.includes(outputs[outputs.length - 1].address))
        return (
          outputs
            .slice(0, outputs.length - 1)
            .map(element => +element.amount)
            .reduce((a, b) => a + b, 0) * -1
        );
      if (
        outputs.length > 1 &&
        outputs.findIndex(element => slpAddresses.includes(element.address)) !== -1
      )
        return +outputs.find(element => slpAddresses.includes(element.address)).amount;
    };

    const tokenTransactionHistory = {
      confirmed: [],
      unconfirmed: [],
      lastUnconfirmedSentTx: null
    };

    const unconfirmedTxs = await getUnconfirmedTxs(slpAddresses);

    if (unconfirmedTxs.length > 0) {
      const decodedTxs = await decodeRawSlpTrasactionsByTxs(unconfirmedTxs, tokenInfo);

      tokenTransactionHistory.unconfirmed = decodedTxs
        .slice(0, 30)
        .map(txidDetail => ({
          txid: txidDetail.txid,
          detail: txidDetail.tokenDetails,
          vin: txidDetail.vin,
          vout: txidDetail.vout,
          balance: calculateTransactionBalance(txidDetail.tokenDetails.outputs),
          confirmations: 0,
          date: new Date()
        }))
        .sort((x, y) => {
          if (Xor(x.detail.transactionType === "GENESIS", y.detail.transactionType === "GENESIS")) {
            return (
              +(x.detail.transactionType === "GENESIS") - +(y.detail.transactionType === "GENESIS")
            );
          } else {
            return 1;
          }
        })
        .map(txDetail => {
          if (
            txDetail.detail.transactionType === "SEND" &&
            txDetail.detail.outputs.length === 1 &&
            slpAddresses.includes(txDetail.detail.outputs[0].address)
          ) {
            return { ...txDetail, detail: { ...txDetail.detail, transactionType: "BURN" } };
          } else {
            return txDetail;
          }
        })
        .map(txDetail => {
          if (txDetail.detail.transactionType === "MINT" && txDetail.balance === 0) {
            return { ...txDetail, detail: { ...txDetail.detail, transactionType: "BURN_BATON" } };
          } else {
            return txDetail;
          }
        });

      const burnTxs = tokenTransactionHistory.unconfirmed.filter(
        txDetail => txDetail.detail.transactionType === "BURN"
      );

      if (burnTxs.length > 0) {
        const revertChunk = chunkedArray =>
          chunkedArray.reduce((unchunkedArray, chunk) => [...unchunkedArray, ...chunk], []);
        const burnTxIds = burnTxs.map(txDetail => txDetail.txid);
        const txIdChunks = chunk(burnTxIds, 20);
        const amounts = revertChunk(
          await Promise.all(txIdChunks.map(txIdChunk => SLP.Utils.burnTotal(txIdChunk)))
        );
        tokenTransactionHistory.unconfirmed = tokenTransactionHistory.unconfirmed.map(txDetail =>
          txDetail.detail.transactionType === "BURN"
            ? {
                ...txDetail,
                detail: {
                  ...txDetail.detail,
                  burnAmount: (amounts.find(amount => amount.transactionId === txDetail.txid) || {})
                    .burnTotal
                }
              }
            : txDetail
        );
      }

      if (tokenTransactionHistory.unconfirmed.length > 1) {
        const sentTxs = tokenTransactionHistory.unconfirmed.filter(
          el =>
            (el.balance > 0 && el.detail.transactionType === "BURN") ||
            (el.balance <= 0 && el.detail.transactionType !== "BURN_BATON")
        );

        if (sentTxs.length > 0) {
          const arrayUnconf = tokenTransactionHistory.unconfirmed;
          tokenTransactionHistory.unconfirmed = sentTxs.reduce((acc, cur, index, array) => {
            acc[index] = [];
            const vin = cur.vin;
            const txIdInVin = arrayUnconf.filter(
              el =>
                vin.filter(
                  item =>
                    item.txid === el.txid && item.vout <= el.detail.outputs.length && item.vout > 0
                ).length > 0 &&
                el.txid !== cur.txid &&
                el.detail.transactionType !== "BURN_BATON"
            );

            if (txIdInVin.length > 0) {
              const hasSentTx = txIdInVin.findIndex(
                el =>
                  (el.balance > 0 && el.detail.transactionType === "BURN") ||
                  (el.balance <= 0 && el.detail.transactionType !== "BURN_BATON")
              );
              if (hasSentTx !== -1 && hasSentTx !== txIdInVin.length - 1) {
                const sentTx = txIdInVin[hasSentTx];
                txIdInVin[hasSentTx] = txIdInVin[txIdInVin.length - 1];
                txIdInVin[txIdInVin.length - 1] = sentTx;
              }

              const isCurrentElementAlreadyOnAccIndex = acc.findIndex(
                accElArr => accElArr.findIndex(accEl => accEl.txid === cur.txid) !== -1
              );
              const isCurrentElementAlreadyOnAcc = isCurrentElementAlreadyOnAccIndex !== -1;
              const currentElementHasSentTxInVinIndex = acc.findIndex(
                accElArr =>
                  accElArr.findIndex(
                    accEl => accEl.txid === txIdInVin[txIdInVin.length - 1].txid
                  ) !== -1
              );
              const currentElementHasSentTxInVin =
                hasSentTx !== -1 && currentElementHasSentTxInVinIndex !== -1;

              if (isCurrentElementAlreadyOnAcc && currentElementHasSentTxInVin) {
                acc[isCurrentElementAlreadyOnAccIndex] = acc[isCurrentElementAlreadyOnAccIndex]
                  .concat(txIdInVin.slice(0, txIdInVin.length - 1))
                  .concat(acc[currentElementHasSentTxInVinIndex]);
                acc[currentElementHasSentTxInVinIndex] = [];
              }

              if (isCurrentElementAlreadyOnAcc && !currentElementHasSentTxInVin) {
                acc[isCurrentElementAlreadyOnAccIndex] = acc[
                  isCurrentElementAlreadyOnAccIndex
                ].concat(txIdInVin);
              }

              if (!isCurrentElementAlreadyOnAcc && currentElementHasSentTxInVin) {
                acc[index].push(cur);
                acc[index] = acc[index].concat(txIdInVin.slice(0, txIdInVin.length - 1));
                acc[index] = acc[index].concat(acc[currentElementHasSentTxInVinIndex]);
                acc[currentElementHasSentTxInVinIndex] = [];
              }

              if (!isCurrentElementAlreadyOnAcc && !currentElementHasSentTxInVin) {
                acc[index].push(cur);

                acc[index] = acc[index].concat(txIdInVin);
              }
            } else {
              const isCurrentElementAlreadyOnAccIndex = acc.findIndex(
                accElArr => accElArr.findIndex(accEl => accEl.txid === cur.txid) !== -1
              );
              const isCurrentElementAlreadyOnAcc = isCurrentElementAlreadyOnAccIndex !== -1;
              if (!isCurrentElementAlreadyOnAcc) {
                acc[index].push(cur);
              }
            }

            if (index < array.length - 1) {
              return acc;
            } else {
              const accNoEmptyElements = acc.filter(el => !(Array.isArray(el) && el.length === 0));
              const burnBatonTx = arrayUnconf.find(
                el => el.detail.transactionType === "BURN_BATON"
              );
              if (burnBatonTx) {
                accNoEmptyElements[0].unshift(burnBatonTx);
              }

              const genesisTxIndex = accNoEmptyElements.findIndex(
                elArr => elArr.findIndex(el => el.detail.transactionType === "GENESIS") !== -1
              );
              if (genesisTxIndex !== -1 && genesisTxIndex !== accNoEmptyElements.length - 1) {
                const lastItem = accNoEmptyElements[accNoEmptyElements.length - 1];
                const genesisTx = accNoEmptyElements[genesisTxIndex];
                accNoEmptyElements[genesisTxIndex] = lastItem;
                accNoEmptyElements[accNoEmptyElements.length - 1] = genesisTx;
              }

              const remainingTxs = arrayUnconf.filter(
                x =>
                  !accNoEmptyElements.reduce((a, b) => a.concat(b), []).some(e => e.txid === x.txid)
              );
              if (remainingTxs.length > 0) {
                const remainingGenesis = remainingTxs.find(
                  el => el.detail.transactionType === "GENESIS"
                );
                if (burnBatonTx && remainingGenesis) {
                  accNoEmptyElements.push([remainingGenesis]);
                  accNoEmptyElements[0] = [
                    burnBatonTx,
                    ...remainingTxs.filter(el => el.detail.transactionType !== "GENESIS"),
                    ...accNoEmptyElements[0].slice(1)
                  ];
                }
                if (!burnBatonTx && remainingGenesis) {
                  accNoEmptyElements.push([remainingGenesis]);
                  accNoEmptyElements[0] = [
                    ...remainingTxs.filter(el => el.detail.transactionType !== "GENESIS"),
                    ...accNoEmptyElements[0]
                  ];
                }
                if (burnBatonTx && !remainingGenesis) {
                  accNoEmptyElements[0] = [
                    burnBatonTx,
                    ...remainingTxs,
                    ...accNoEmptyElements[0].slice(1)
                  ];
                }

                if (!burnBatonTx && !remainingGenesis) {
                  accNoEmptyElements[0] = [...remainingTxs, ...accNoEmptyElements[0]];
                }
              }
              if (accNoEmptyElements.length > 1) {
                const newLength = accNoEmptyElements.length * 2 - 1;

                const accWithMockedBurnAll = Array.from({ length: newLength }).map((e, i) =>
                  i % 2 === 0
                    ? accNoEmptyElements[i / 2]
                    : mockedArrayBurnAll(`unconf-${i}-burn-all`)
                );
                return accWithMockedBurnAll.reduce((a, b) => a.concat(b), []);
              } else {
                return accNoEmptyElements.reduce((a, b) => a.concat(b), []);
              }
            }
          }, []);
        }
      }

      tokenTransactionHistory.unconfirmed = tokenTransactionHistory.unconfirmed
        .reduce((acc, cur, index, array) => {
          if (index === 0) {
            const nextSentTxIndex = array.findIndex(
              el =>
                (el.balance > 0 && el.detail.transactionType === "BURN") ||
                (el.balance <= 0 &&
                  el.detail.transactionType !== "BURN_BATON" &&
                  el.detail.transactionType !== "BURN_ALL")
            );
            if (nextSentTxIndex !== -1) {
              const txIdInVin = array
                .slice(0, nextSentTxIndex + 1)
                .filter(
                  el =>
                    el.detail.transactionType !== "BURN_ALL" &&
                    el.detail.transactionType !== "BURN_BATON" &&
                    tokenUtxos.filter(
                      item =>
                        item.txid === el.txid &&
                        item.vout <= el.detail.outputs.length &&
                        item.vout > 0
                    ).length > 0
                );
              if (
                txIdInVin.length ===
                array
                  .slice(0, nextSentTxIndex + 1)
                  .filter(
                    el =>
                      el.detail.transactionType !== "BURN_ALL" &&
                      el.detail.transactionType !== "BURN_BATON"
                  ).length
              ) {
                return { result: array, lastIndex: nextSentTxIndex };
              } else {
                const burnAllIndexes = array
                  .slice(0, nextSentTxIndex + 1)
                  .reduce((acc, cur, index) => {
                    if (
                      !txIdInVin.some(e => e.txid === cur.txid) &&
                      cur.detail.transactionType !== "BURN_ALL" &&
                      cur.detail.transactionType !== "BURN_BATON"
                    ) {
                      acc.push(index);
                    }
                    return acc;
                  }, []);

                const slicedArrayWithBurnAllItems = burnAllIndexes.reduce((acc, cur, index) => {
                  return insert(acc, cur + index, mockedBurnAll(`unconf-${cur + index}-burn-all`));
                }, array);
                return { result: slicedArrayWithBurnAllItems, lastIndex: nextSentTxIndex };
              }
            } else {
              const txIdInVin = array
                .slice(0, array.length)
                .filter(
                  el =>
                    el.detail.transactionType !== "BURN_ALL" &&
                    el.detail.transactionType !== "BURN_BATON" &&
                    tokenUtxos.filter(
                      item =>
                        item.txid === el.txid &&
                        item.vout <= el.detail.outputs.length &&
                        item.vout > 0
                    ).length > 0
                );

              if (
                txIdInVin.length ===
                array
                  .slice(0, array.length)
                  .filter(
                    el =>
                      el.detail.transactionType !== "BURN_ALL" &&
                      el.detail.transactionType !== "BURN_BATON"
                  ).length
              ) {
                return array.length > 1 ? { result: array, lastIndex: array.length - 1 } : array;
              } else {
                const burnAllIndexes = array.slice(0, array.length).reduce((acc, cur, index) => {
                  if (
                    !txIdInVin.some(e => e.txid === cur.txid) &&
                    cur.detail.transactionType !== "BURN_ALL" &&
                    cur.detail.transactionType !== "BURN_BATON"
                  ) {
                    acc.push(index);
                  }
                  return acc;
                }, []);

                const slicedArrayWithBurnAllItems = burnAllIndexes.reduce((acc, cur, index) => {
                  return insert(acc, cur + index, mockedBurnAll(`unconf-${cur + index}-burn-all`));
                }, array);
                return { result: slicedArrayWithBurnAllItems, lastIndex: array.length - 1 };
              }
            }
          } else {
            if (index === array.length - 1) {
              return acc.result;
            } else {
              return acc;
            }
          }
        }, [])
        .filter(
          (tx, index, array) =>
            !(
              tx.detail.transactionType === "BURN_ALL" &&
              array.length > 1 &&
              array[index + 1].detail.transactionType === "SEND" &&
              array[index + 1].detail.outputs.length &&
              array[index + 1].detail.outputs.findIndex(output =>
                slpAddresses.includes(output.address)
              ) === -1
            )
        );
      tokenTransactionHistory.lastUnconfirmedSentTx = tokenTransactionHistory.unconfirmed
        .slice()
        .reverse()
        .find(
          el =>
            (el.balance > 0 && el.detail.transactionType === "BURN") ||
            (el.balance <= 0 &&
              el.detail.transactionType !== "BURN_BATON" &&
              el.detail.transactionType !== "BURN_ALL")
        );
    }

    const remainingNumberTxsDetails = 30 - tokenTransactionHistory.unconfirmed.length;

    const transactions = await getConfirmedSlpTxsByTokenId(slpAddresses, tokenId);

    if (
      transactions.reduce((a, b) => a.concat(b), []).length > 0 &&
      remainingNumberTxsDetails > 0
    ) {
      const lastNtrancations = (N, transactions) => transactions.map(el => el.slice(0, N));
      const slicedTransactions = lastNtrancations(remainingNumberTxsDetails, transactions);
      const concatenatedTransactions = slicedTransactions.reduce((a, b) => a.concat(b), []);
      const uniqueTxids = [
        ...new Set(concatenatedTransactions.map(transaction => transaction.txid))
      ];

      const revertChunk = chunkedArray =>
        chunkedArray.reduce((unchunkedArray, chunk) => [...unchunkedArray, ...chunk], []);

      const txidChunks = chunk(uniqueTxids, 20);
      const txidDetails = revertChunk(
        await Promise.all(txidChunks.map(txidChunk => SLP.Transaction.details(txidChunk)))
      );

      tokenTransactionHistory.confirmed = txidDetails
        .map(txidDetail => ({
          txid: txidDetail.txid,
          detail: concatenatedTransactions.find(el => el.txid === txidDetail.txid).tokenDetails
            .detail,
          vin: txidDetail.vin,
          vout: txidDetail.vout,
          balance: calculateTransactionBalance(
            concatenatedTransactions.find(el => el.txid === txidDetail.txid).tokenDetails.detail
              .outputs
          ),
          confirmations: txidDetail.confirmations,
          date: new Date(txidDetail.time * 1000),
          time: txidDetail.time
        }))
        .sort((x, y) => {
          if (Xor(x.detail.transactionType === "GENESIS", y.detail.transactionType === "GENESIS")) {
            return (
              +(x.detail.transactionType === "GENESIS") - +(y.detail.transactionType === "GENESIS")
            );
          }
          if (y.time === x.time) {
            return -1;
          } else {
            return y.time - x.time;
          }
        })
        .slice(0, remainingNumberTxsDetails)
        .map(txDetail => {
          if (
            txDetail.detail.transactionType === "SEND" &&
            txDetail.detail.outputs.length === 1 &&
            slpAddresses.includes(txDetail.detail.outputs[0].address)
          ) {
            return { ...txDetail, detail: { ...txDetail.detail, transactionType: "BURN" } };
          } else {
            return txDetail;
          }
        })
        .map(txDetail => {
          if (txDetail.detail.transactionType === "MINT" && txDetail.balance === 0) {
            return { ...txDetail, detail: { ...txDetail.detail, transactionType: "BURN_BATON" } };
          } else {
            return txDetail;
          }
        })
        .reduce((acc, cur, index, array) => {
          acc[index] = [];
          if (
            (index > 0 && cur.time === array[index - 1].time) ||
            (index < array.length - 1 && cur.time === array[index + 1].time)
          ) {
            const fisrtOcur = array.findIndex(el => el.time === cur.time);
            acc[fisrtOcur].push(cur);
          } else {
            acc[index] = cur;
          }
          return index < array.length - 1
            ? acc
            : acc.filter(el => !(Array.isArray(el) && el.length === 0));
        }, [])
        .map((concatDetails, concatDetailsIndex) => {
          if (Array.isArray(concatDetails)) {
            const sentTxs = concatDetails.filter(
              el =>
                (el.balance > 0 && el.detail.transactionType === "BURN") ||
                (el.balance <= 0 && el.detail.transactionType !== "BURN_BATON")
            );

            if (sentTxs.length > 0) {
              return sentTxs.reduce((acc, cur, index, array) => {
                acc[index] = [];
                const vin = cur.vin;
                const txIdInVin = concatDetails.filter(
                  el =>
                    vin.filter(
                      item =>
                        item.txid === el.txid &&
                        item.vout <= el.detail.outputs.length &&
                        item.vout > 0
                    ).length > 0 &&
                    el.txid !== cur.txid &&
                    el.detail.transactionType !== "BURN_BATON"
                );

                if (txIdInVin.length > 0) {
                  const hasSentTx = txIdInVin.findIndex(
                    el =>
                      (el.balance > 0 && el.detail.transactionType === "BURN") ||
                      (el.balance <= 0 && el.detail.transactionType !== "BURN_BATON")
                  );
                  if (hasSentTx !== -1 && hasSentTx !== txIdInVin.length - 1) {
                    const sentTx = txIdInVin[hasSentTx];
                    txIdInVin[hasSentTx] = txIdInVin[txIdInVin.length - 1];
                    txIdInVin[txIdInVin.length - 1] = sentTx;
                  }

                  const isCurrentElementAlreadyOnAccIndex = acc.findIndex(
                    accElArr => accElArr.findIndex(accEl => accEl.txid === cur.txid) !== -1
                  );
                  const isCurrentElementAlreadyOnAcc = isCurrentElementAlreadyOnAccIndex !== -1;
                  const currentElementHasSentTxInVinIndex = acc.findIndex(
                    accElArr =>
                      accElArr.findIndex(
                        accEl => accEl.txid === txIdInVin[txIdInVin.length - 1].txid
                      ) !== -1
                  );
                  const currentElementHasSentTxInVin =
                    hasSentTx !== -1 && currentElementHasSentTxInVinIndex !== -1;

                  if (isCurrentElementAlreadyOnAcc && currentElementHasSentTxInVin) {
                    acc[isCurrentElementAlreadyOnAccIndex] = acc[isCurrentElementAlreadyOnAccIndex]
                      .concat(txIdInVin.slice(0, txIdInVin.length - 1))
                      .concat(acc[currentElementHasSentTxInVinIndex]);
                    acc[currentElementHasSentTxInVinIndex] = [];
                  }

                  if (isCurrentElementAlreadyOnAcc && !currentElementHasSentTxInVin) {
                    acc[isCurrentElementAlreadyOnAccIndex] = acc[
                      isCurrentElementAlreadyOnAccIndex
                    ].concat(txIdInVin);
                  }

                  if (!isCurrentElementAlreadyOnAcc && currentElementHasSentTxInVin) {
                    acc[index].push(cur);
                    acc[index] = acc[index].concat(txIdInVin.slice(0, txIdInVin.length - 1));
                    acc[index] = acc[index].concat(acc[currentElementHasSentTxInVinIndex]);
                    acc[currentElementHasSentTxInVinIndex] = [];
                  }

                  if (!isCurrentElementAlreadyOnAcc && !currentElementHasSentTxInVin) {
                    acc[index].push(cur);

                    acc[index] = acc[index].concat(txIdInVin);
                  }
                } else {
                  const isCurrentElementAlreadyOnAccIndex = acc.findIndex(
                    accElArr => accElArr.findIndex(accEl => accEl.txid === cur.txid) !== -1
                  );
                  const isCurrentElementAlreadyOnAcc = isCurrentElementAlreadyOnAccIndex !== -1;
                  if (!isCurrentElementAlreadyOnAcc) {
                    acc[index].push(cur);
                  }
                }

                if (index < array.length - 1) {
                  return acc;
                } else {
                  const accNoEmptyElements = acc.filter(
                    el => !(Array.isArray(el) && el.length === 0)
                  );
                  const burnBatonTx = concatDetails.find(
                    el => el.detail.transactionType === "BURN_BATON"
                  );
                  if (burnBatonTx) {
                    accNoEmptyElements[0].unshift(burnBatonTx);
                  }

                  const genesisTxIndex = accNoEmptyElements.findIndex(
                    elArr => elArr.findIndex(el => el.detail.transactionType === "GENESIS") !== -1
                  );
                  if (genesisTxIndex !== -1 && genesisTxIndex !== accNoEmptyElements.length - 1) {
                    const lastItem = accNoEmptyElements[accNoEmptyElements.length - 1];
                    const genesisTx = accNoEmptyElements[genesisTxIndex];
                    accNoEmptyElements[genesisTxIndex] = lastItem;
                    accNoEmptyElements[accNoEmptyElements.length - 1] = genesisTx;
                  }

                  const remainingTxs = concatDetails.filter(
                    x =>
                      !accNoEmptyElements
                        .reduce((a, b) => a.concat(b), [])
                        .some(e => e.txid === x.txid)
                  );
                  if (remainingTxs.length > 0) {
                    const remainingGenesis = remainingTxs.find(
                      el => el.detail.transactionType === "GENESIS"
                    );
                    if (burnBatonTx && remainingGenesis) {
                      accNoEmptyElements.push([remainingGenesis]);
                      accNoEmptyElements[0] = [
                        burnBatonTx,
                        ...remainingTxs.filter(el => el.detail.transactionType !== "GENESIS"),
                        ...accNoEmptyElements[0].slice(1)
                      ];
                    }
                    if (!burnBatonTx && remainingGenesis) {
                      accNoEmptyElements.push([remainingGenesis]);
                      accNoEmptyElements[0] = [
                        ...remainingTxs.filter(el => el.detail.transactionType !== "GENESIS"),
                        ...accNoEmptyElements[0]
                      ];
                    }
                    if (burnBatonTx && !remainingGenesis) {
                      accNoEmptyElements[0] = [
                        burnBatonTx,
                        ...remainingTxs,
                        ...accNoEmptyElements[0].slice(1)
                      ];
                    }

                    if (!burnBatonTx && !remainingGenesis) {
                      accNoEmptyElements[0] = [...remainingTxs, ...accNoEmptyElements[0]];
                    }
                  }
                  if (accNoEmptyElements.length > 1) {
                    const newLength = accNoEmptyElements.length * 2 - 1;

                    const accWithMockedBurnAll = Array.from({ length: newLength }).map((e, i) =>
                      i % 2 === 0
                        ? accNoEmptyElements[i / 2]
                        : mockedArrayBurnAll(`${concatDetailsIndex}-${i}-burn-all`)
                    );
                    return accWithMockedBurnAll.reduce((a, b) => a.concat(b), []);
                  } else {
                    return accNoEmptyElements.reduce((a, b) => a.concat(b), []);
                  }
                }
              }, []);
            } else {
              return concatDetails;
            }
          } else {
            return concatDetails;
          }
        })
        .reduce((a, b) => a.concat(b), [])
        .reduce((acc, cur, index, array) => {
          if (index === 0) {
            const nextSentTxIndex = array.findIndex(
              el =>
                (el.balance > 0 && el.detail.transactionType === "BURN") ||
                (el.balance <= 0 &&
                  el.detail.transactionType !== "BURN_BATON" &&
                  el.detail.transactionType !== "BURN_ALL")
            );

            if (nextSentTxIndex !== -1) {
              const lastUtxos = transactions.lastUnconfirmedSentTx
                ? transactions.lastUnconfirmedSentTx.vin
                : tokenUtxos;

              const txIdInVin = array
                .slice(0, nextSentTxIndex + 1)
                .filter(
                  el =>
                    el.detail.transactionType !== "BURN_ALL" &&
                    el.detail.transactionType !== "BURN_BATON" &&
                    lastUtxos.filter(
                      item =>
                        item.txid === el.txid &&
                        item.vout <= el.detail.outputs.length &&
                        item.vout > 0
                    ).length > 0
                );

              if (
                txIdInVin.length ===
                  array
                    .slice(0, nextSentTxIndex + 1)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON"
                    ).length &&
                nextSentTxIndex !== 0
              ) {
                return { result: array, lastIndex: nextSentTxIndex };
              } else if (
                txIdInVin.length !==
                  array
                    .slice(0, nextSentTxIndex + 1)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON"
                    ).length &&
                nextSentTxIndex !== 0
              ) {
                const burnAllIndexes = array
                  .slice(0, nextSentTxIndex + 1)
                  .reduce((acc, cur, index) => {
                    if (
                      !txIdInVin.some(e => e.txid === cur.txid) &&
                      cur.detail.transactionType !== "BURN_ALL" &&
                      cur.detail.transactionType !== "BURN_BATON"
                    ) {
                      acc.push(index);
                    }
                    return acc;
                  }, []);

                const slicedArrayWithBurnAllItems = burnAllIndexes.reduce((acc, cur, index) => {
                  return insert(acc, cur + index, mockedBurnAll(`${cur + index}-burn-all`));
                }, array);

                return { result: slicedArrayWithBurnAllItems, lastIndex: nextSentTxIndex };
              } else if (nextSentTxIndex === 0) {
                const secondNextSentTx = array
                  .slice(1, array.length)
                  .find(
                    el =>
                      (el.balance > 0 && el.detail.transactionType === "BURN") ||
                      (el.balance <= 0 &&
                        el.detail.transactionType !== "BURN_BATON" &&
                        el.detail.transactionType !== "BURN_ALL")
                  );

                const secondNextSentTxIndex = array
                  .slice(1, array.length)
                  .findIndex(
                    el =>
                      (el.balance > 0 && el.detail.transactionType === "BURN") ||
                      (el.balance <= 0 &&
                        el.detail.transactionType !== "BURN_BATON" &&
                        el.detail.transactionType !== "BURN_ALL")
                  );

                const isBurAllLastTx =
                  txIdInVin.length !==
                  array
                    .slice(0, nextSentTxIndex + 1)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON"
                    ).length;

                if (
                  !isBurAllLastTx &&
                  secondNextSentTxIndex !== -1 &&
                  secondNextSentTx.time === array[0].time
                ) {
                  return { result: array, lastIndex: secondNextSentTxIndex + 1 };
                } else if (
                  isBurAllLastTx &&
                  secondNextSentTxIndex !== -1 &&
                  secondNextSentTx.time === array[0].time
                ) {
                  const burnAllIndexes = array
                    .slice(0, nextSentTxIndex + 1)
                    .reduce((acc, cur, index) => {
                      if (
                        !txIdInVin.some(e => e.txid === cur.txid) &&
                        cur.detail.transactionType !== "BURN_ALL" &&
                        cur.detail.transactionType !== "BURN_BATON"
                      ) {
                        acc.push(index);
                      }
                      return acc;
                    }, []);

                  const slicedArrayWithBurnAllItems = burnAllIndexes.reduce((acc, cur, index) => {
                    return insert(acc, cur + index, mockedBurnAll(`${cur + index}-burn-all`));
                  }, array);

                  return {
                    result: slicedArrayWithBurnAllItems,
                    lastIndex: secondNextSentTxIndex + 1
                  };
                } else if (secondNextSentTxIndex === -1) {
                  const txIdInFirstSentVin = array
                    .slice(1, array.length)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON" &&
                        array[0].vin.filter(
                          item =>
                            item.txid === el.txid &&
                            item.vout <= el.detail.outputs.length &&
                            item.vout > 0
                        ).length > 0
                    );

                  if (
                    txIdInFirstSentVin.length ===
                    array
                      .slice(1, array.length)
                      .filter(
                        el =>
                          el.detail.transactionType !== "BURN_ALL" &&
                          el.detail.transactionType !== "BURN_BATON"
                      ).length
                  ) {
                    return array.length > 1
                      ? {
                          result: isBurAllLastTx
                            ? insert(array, 0, mockedBurnAll(`0-burn-all`))
                            : array,
                          lastIndex: array.length - 1
                        }
                      : array;
                  } else {
                    const burnAllIndexes = array
                      .slice(1, array.length)
                      .reduce((acc, cur, index) => {
                        if (
                          !txIdInFirstSentVin.some(e => e.txid === cur.txid) &&
                          cur.detail.transactionType !== "BURN_ALL" &&
                          cur.detail.transactionType !== "BURN_BATON"
                        ) {
                          acc.push(index + 1);
                        }
                        return acc;
                      }, []);

                    const slicedArrayWithBurnAllItems = burnAllIndexes.reduce((acc, cur, index) => {
                      return insert(acc, cur + index, mockedBurnAll(`${cur + index}-burn-all`));
                    }, array);
                    return {
                      result: isBurAllLastTx
                        ? insert(slicedArrayWithBurnAllItems, 0, mockedBurnAll(`0-burn-all`))
                        : slicedArrayWithBurnAllItems,
                      lastIndex: array.length - 1
                    };
                  }
                } else if (
                  secondNextSentTxIndex !== -1 &&
                  secondNextSentTx.time !== array[0].time
                ) {
                  const txIdInFirstSentVin = array
                    .slice(1, secondNextSentTxIndex + 1)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON" &&
                        array[0].vin.filter(
                          item =>
                            item.txid === el.txid &&
                            item.vout <= el.detail.outputs.length &&
                            item.vout > 0
                        ).length > 0
                    );

                  if (
                    txIdInFirstSentVin.length ===
                    array
                      .slice(1, secondNextSentTxIndex + 1)
                      .filter(
                        el =>
                          el.detail.transactionType !== "BURN_ALL" &&
                          el.detail.transactionType !== "BURN_BATON"
                      ).length
                  ) {
                    return {
                      result: isBurAllLastTx
                        ? insert(array, 0, mockedBurnAll(`0-burn-all`))
                        : array,
                      lastIndex: secondNextSentTxIndex + 1
                    };
                  } else {
                    const burnAllIndexes = array
                      .slice(1, secondNextSentTxIndex + 1)
                      .reduce((acc, cur, itemIndex) => {
                        if (
                          !txIdInFirstSentVin.some(e => e.txid === cur.txid) &&
                          cur.detail.transactionType !== "BURN_ALL" &&
                          cur.detail.transactionType !== "BURN_BATON"
                        ) {
                          acc.push(itemIndex + 1);
                        }
                        return acc;
                      }, []);

                    const slicedArrayWithBurnAllItems = burnAllIndexes.reduce(
                      (accItem, curItem, itemIndex) => {
                        return insert(
                          accItem,
                          curItem + itemIndex,
                          mockedBurnAll(`${curItem + itemIndex}-burn-all`)
                        );
                      },
                      array
                    );
                    return {
                      result: isBurAllLastTx
                        ? insert(slicedArrayWithBurnAllItems, 0, mockedBurnAll(`0-burn-all`))
                        : slicedArrayWithBurnAllItems,
                      lastIndex: secondNextSentTxIndex + 1
                    };
                  }
                } else {
                  return { result: array, lastIndex: array.length - 1 };
                }
              } else {
                return { result: array, lastIndex: array.length - 1 };
              }
            } else {
              const lastUtxos = transactions.lastUnconfirmedSentTx
                ? transactions.lastUnconfirmedSentTx.vin
                : tokenUtxos;

              const txIdInVin = array
                .slice(0, array.length)
                .filter(
                  el =>
                    el.detail.transactionType !== "BURN_ALL" &&
                    el.detail.transactionType !== "BURN_BATON" &&
                    lastUtxos.filter(
                      item =>
                        item.txid === el.txid &&
                        item.vout <= el.detail.outputs.length &&
                        item.vout > 0
                    ).length > 0
                );

              if (
                txIdInVin.length ===
                array
                  .slice(0, array.length)
                  .filter(
                    el =>
                      el.detail.transactionType !== "BURN_ALL" &&
                      el.detail.transactionType !== "BURN_BATON"
                  ).length
              ) {
                return array.length > 1 ? { result: array, lastIndex: array.length - 1 } : array;
              } else {
                const burnAllIndexes = array.slice(0, array.length).reduce((acc, cur, index) => {
                  if (
                    !txIdInVin.some(e => e.txid === cur.txid) &&
                    cur.detail.transactionType !== "BURN_ALL" &&
                    cur.detail.transactionType !== "BURN_BATON"
                  ) {
                    acc.push(index);
                  }
                  return acc;
                }, []);

                const slicedArrayWithBurnAllItems = burnAllIndexes.reduce((acc, cur, index) => {
                  return insert(acc, cur + index, mockedBurnAll(`${cur + index}-burn-all`));
                }, array);
                return { result: slicedArrayWithBurnAllItems, lastIndex: array.length - 1 };
              }
            }
          } else {
            if (index === acc.lastIndex && acc.lastIndex !== array.length - 1) {
              const nextSentTx = array
                .slice(index + 1)
                .find(
                  el =>
                    (el.balance > 0 && el.detail.transactionType === "BURN") ||
                    (el.balance <= 0 &&
                      el.detail.transactionType !== "BURN_BATON" &&
                      el.detail.transactionType !== "BURN_ALL")
                );

              const nextSentTxIndex = array
                .slice(index + 1)
                .findIndex(
                  el =>
                    (el.balance > 0 && el.detail.transactionType === "BURN") ||
                    (el.balance <= 0 &&
                      el.detail.transactionType !== "BURN_BATON" &&
                      el.detail.transactionType !== "BURN_ALL")
                );

              if (nextSentTx && nextSentTx.time === array[acc.lastIndex].time) {
                return { result: acc.result, lastIndex: nextSentTxIndex + index + 1 };
              }

              if (nextSentTxIndex !== -1 && nextSentTx.time !== array[acc.lastIndex].time) {
                const txIdInVin = array
                  .slice(index + 1, nextSentTxIndex + index + 2)
                  .filter(
                    el =>
                      el.detail.transactionType !== "BURN_ALL" &&
                      el.detail.transactionType !== "BURN_BATON" &&
                      array[acc.lastIndex].vin.filter(
                        item =>
                          item.txid === el.txid &&
                          item.vout <= el.detail.outputs.length &&
                          item.vout > 0
                      ).length > 0
                  );

                if (
                  txIdInVin.length ===
                  array
                    .slice(index + 1, nextSentTxIndex + index + 2)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON"
                    ).length
                ) {
                  return { result: acc.result, lastIndex: nextSentTxIndex + index + 1 };
                } else {
                  const numberBurnAlls =
                    acc.result.filter(e => e.detail.transactionType === "BURN_ALL").length -
                    array.filter(e => e.detail.transactionType === "BURN_ALL").length;

                  const burnAllIndexes = array
                    .slice(index + 1, nextSentTxIndex + index + 2)
                    .reduce((acc, cur, itemIndex) => {
                      if (
                        !txIdInVin.some(e => e.txid === cur.txid) &&
                        cur.detail.transactionType !== "BURN_ALL" &&
                        cur.detail.transactionType !== "BURN_BATON"
                      ) {
                        acc.push(itemIndex + index + 1);
                      }
                      return acc;
                    }, []);
                  const slicedArrayWithBurnAllItems = burnAllIndexes.reduce(
                    (accItem, curItem, itemIndex) => {
                      return insert(
                        accItem,
                        curItem + itemIndex + numberBurnAlls,
                        mockedBurnAll(`${curItem + itemIndex}-burn-all`)
                      );
                    },
                    acc.result
                  );
                  return {
                    result: slicedArrayWithBurnAllItems,
                    lastIndex: nextSentTxIndex + index + 1
                  };
                }
              } else {
                const txIdInVin = array
                  .slice(index + 1)
                  .filter(
                    el =>
                      el.detail.transactionType !== "BURN_ALL" &&
                      el.detail.transactionType !== "BURN_BATON" &&
                      array[acc.lastIndex].vin.filter(
                        item =>
                          item.txid === el.txid &&
                          item.vout <= el.detail.outputs.length &&
                          item.vout > 0
                      ).length > 0
                  );

                if (
                  txIdInVin.length ===
                  array
                    .slice(index + 1)
                    .filter(
                      el =>
                        el.detail.transactionType !== "BURN_ALL" &&
                        el.detail.transactionType !== "BURN_BATON"
                    ).length
                ) {
                  return { result: acc.result, lastIndex: array.length - 1 };
                } else {
                  const burnAllIndexes = array.slice(index + 1).reduce((acc, cur, itemIndex) => {
                    if (
                      !txIdInVin.some(e => e.txid === cur.txid) &&
                      cur.detail.transactionType !== "BURN_ALL" &&
                      cur.detail.transactionType !== "BURN_BATON"
                    ) {
                      acc.push(itemIndex + index + 1);
                    }
                    return acc;
                  }, []);

                  const numberBurnAlls =
                    acc.result.filter(e => e.detail.transactionType === "BURN_ALL").length -
                    array.filter(e => e.detail.transactionType === "BURN_ALL").length;

                  const slicedArrayWithBurnAllItems = burnAllIndexes.reduce(
                    (accItem, curItem, itemIndex) => {
                      return insert(
                        accItem,
                        curItem + itemIndex + numberBurnAlls,
                        mockedBurnAll(`${curItem + itemIndex}-burn-all`)
                      );
                    },
                    acc.result
                  );
                  return { result: slicedArrayWithBurnAllItems, lastIndex: array.length - 1 };
                }
              }
            } else {
              if (index === array.length - 1) {
                return acc.result;
              } else {
                return acc;
              }
            }
          }
        }, [])
        .filter(
          (tx, index, array) =>
            !(
              tx.detail.transactionType === "BURN_ALL" &&
              array.length > 1 &&
              array[index + 1].detail.transactionType === "SEND" &&
              array[index + 1].detail.outputs.length &&
              array[index + 1].detail.outputs.findIndex(output =>
                slpAddresses.includes(output.address)
              ) === -1
            )
        );

      const burnTxs = tokenTransactionHistory.confirmed.filter(
        txDetail => txDetail.detail.transactionType === "BURN"
      );

      if (burnTxs.length > 0) {
        const revertChunk = chunkedArray =>
          chunkedArray.reduce((unchunkedArray, chunk) => [...unchunkedArray, ...chunk], []);
        const burnTxIds = burnTxs.map(txDetail => txDetail.txid);
        const txIdChunks = chunk(burnTxIds, 20);
        const amounts = revertChunk(
          await Promise.all(txIdChunks.map(txIdChunk => SLP.Utils.burnTotal(txIdChunk)))
        );
        tokenTransactionHistory.confirmed = tokenTransactionHistory.confirmed.map(txDetail =>
          txDetail.detail.transactionType === "BURN"
            ? {
                ...txDetail,
                detail: {
                  ...txDetail.detail,
                  burnAmount: (amounts.find(amount => amount.transactionId === txDetail.txid) || {})
                    .burnTotal
                }
              }
            : txDetail
        );
      }
    }

    const { unconfirmed, confirmed } = tokenTransactionHistory;
    const tokenHistory = unconfirmed.concat(confirmed);

    return tokenHistory;
  } catch (err) {
    console.log("err", err);
    // const ff = () => {
    //   throw err;
    // };
    // ff();

    throw err;
  }
};

export default withSLP(getTokenTransactionHistory);
