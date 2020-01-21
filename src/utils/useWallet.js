/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useState } from "react";
import Paragraph from "antd/lib/typography/Paragraph";
import _ from "lodash";
import { notification } from "antd";
import Big from "big.js";
import { getWallet, createWallet } from "./createWallet";
import useInterval from "./useInterval";
import usePrevious from "./usePrevious";
import withSLP from "./withSLP";
import getSlpBanlancesAndUtxos from "./getSlpBanlancesAndUtxos";

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

const update = withSLP(
  async (
    SLP,
    { wallet, setBalances, setTokens, setSlpBalancesAndUtxos, previousSlpBalancesAndUtxos }
  ) => {
    try {
      if (!wallet) {
        return;
      }
      const slpBalancesAndUtxos = await getSlpBanlancesAndUtxos(wallet.cashAddresses);

      const { tokens } = slpBalancesAndUtxos;

      setSlpBalancesAndUtxos(prev =>
        !_.isEqual(prev, normalizeSlpBalancesAndUtxos(SLP, slpBalancesAndUtxos, wallet))
          ? normalizeSlpBalancesAndUtxos(SLP, slpBalancesAndUtxos, wallet)
          : prev
      );
      setBalances(prev =>
        !_.isEqual(prev, normalizeBalance(SLP, slpBalancesAndUtxos))
          ? normalizeBalance(SLP, slpBalancesAndUtxos)
          : prev
      );
      setTokens(prev => (!_.isEqual(prev, tokens) ? tokens : prev));

      return;
    } catch (error) {}
  }
);

export const useWallet = () => {
  const [wallet, setWallet] = useState(getWallet());
  const [balances, setBalances] = useState({});
  const [tokens, setTokens] = useState([]);
  const [slpBalancesAndUtxos, setSlpBalancesAndUtxos] = useState([]);
  const [slpBalancesAndUtxosResp, setSlpBalancesAndUtxosResp] = useState({});
  const [loading, setLoading] = useState(true);

  const previousBalances = usePrevious(balances);

  const previousSlpBalancesAndUtxosResp = usePrevious(slpBalancesAndUtxosResp);

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

  useInterval(() => {
    console.log("update");
    update({
      wallet: getWallet(),
      setBalances,
      setTokens,
      setSlpBalancesAndUtxos,
      setSlpBalancesAndUtxosResp,
      previousSlpBalancesAndUtxosResp
    }).finally(() => {
      setLoading(false);
    });
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
        setBalances,
        setTokens,
        setLoading,
        setSlpBalancesAndUtxos,
        setSlpBalancesAndUtxosResp,
        previousSlpBalancesAndUtxosResp
      }),
    createWallet: importMnemonic => {
      setLoading(true);
      const newWallet = createWallet(importMnemonic);
      setWallet(newWallet);
      update({
        wallet: newWallet,
        setBalances,
        setTokens,
        setSlpBalancesAndUtxos,
        setSlpBalancesAndUtxosResp,
        previousSlpBalancesAndUtxosResp
      }).finally(() => setLoading(false));
    }
  };
};
