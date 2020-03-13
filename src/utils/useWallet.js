/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useCallback } from "react";
import Paragraph from "antd/lib/typography/Paragraph";
import { notification } from "antd";
import Big from "big.js";
import { getWallet, createWallet } from "./createWallet";
import useAsyncTimeout from "./useAsyncTimeout";
import usePrevious from "./usePrevious";
import withSLP from "./withSLP";
import getSlpBanlancesAndUtxos from "./getSlpBanlancesAndUtxos";
import DividendsManager from "./dividends/dividendsManager";
import SlpDividendsManager from "./slpDividends/slpDividendsManager";

const normalizeSlpBalancesAndUtxos = (SLP, slpBalancesAndUtxos, wallet) => {
  slpBalancesAndUtxos.nonSlpUtxos.forEach(utxo => {
    const derivatedAccount = wallet.Accounts.find(account => account.cashAddress === utxo.address);
    utxo.wif = derivatedAccount.fundingWif;
  });

  return slpBalancesAndUtxos;
};

const normalizeBalance = (SLP, slpBalancesAndUtxos) => {
  const totalBalanceInSatohis = slpBalancesAndUtxos.nonSlpUtxos.reduce(
    (previousBalance, utxo) => previousBalance + utxo.satoshis,
    0
  );
  return {
    totalBalanceInSatohis,
    totalBalance: SLP.BitcoinCash.toBitcoinCash(totalBalanceInSatohis)
  };
};

const update = withSLP(async (SLP, { wallet, setWalletState }) => {
  try {
    if (!wallet) {
      return;
    }
    const slpBalancesAndUtxos = await getSlpBanlancesAndUtxos(wallet.cashAddresses);
    const { tokens } = slpBalancesAndUtxos;
    const newState = {
      balances: {},
      tokens: [],
      slpBalancesAndUtxos: []
    };

    newState.slpBalancesAndUtxos = normalizeSlpBalancesAndUtxos(SLP, slpBalancesAndUtxos, wallet);
    newState.balances = normalizeBalance(SLP, slpBalancesAndUtxos);
    newState.tokens = tokens;

    setWalletState(newState);
  } catch (error) {}
});

export const useWallet = () => {
  const [wallet, setWallet] = useState(getWallet());
  const [walletState, setWalletState] = useState({
    balances: {},
    tokens: [],
    slpBalancesAndUtxos: {}
  });
  const [loading, setLoading] = useState(true);
  const { balances, tokens, slpBalancesAndUtxos } = walletState;
  const previousBalances = usePrevious(balances);

  if (
    previousBalances &&
    balances &&
    "totalBalance" in previousBalances &&
    "totalBalance" in balances &&
    new Big(balances.totalBalance).minus(previousBalances.totalBalance).gt(0)
  ) {
    notification.success({
      message: "BCH",
      description: (
        <Paragraph>
          You received {Number(balances.totalBalance - previousBalances.totalBalance).toFixed(8)}{" "}
          BCH!
        </Paragraph>
      ),
      duration: 2
    });
  }

  const updateDividends = useCallback(
    async ({ wallet }) => {
      await DividendsManager.update({ wallet, utxos: slpBalancesAndUtxos.nonSlpUtxos });
      if (slpBalancesAndUtxos.slpUtxos) {
        await SlpDividendsManager.update({
          wallet,
          utxos: [...slpBalancesAndUtxos.nonSlpUtxos, ...slpBalancesAndUtxos.slpUtxos]
        });
      }
    },
    [slpBalancesAndUtxos]
  );

  useAsyncTimeout(async () => {
    const wallet = getWallet();
    await update({
      wallet,
      setWalletState
    }).finally(() => {
      setLoading(false);
    });
    await updateDividends({ wallet });
  }, 5000);

  return {
    wallet,
    slpBalancesAndUtxos,
    balances,
    tokens,
    loading,
    update: () =>
      update({
        wallet: getWallet(),

        setLoading,
        setWalletState
      }),
    createWallet: importMnemonic => {
      setLoading(true);
      const newWallet = createWallet(importMnemonic);
      setWallet(newWallet);
      update({
        wallet: newWallet,
        setWalletState
      }).finally(() => setLoading(false));
    }
  };
};
