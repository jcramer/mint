/* eslint-disable react-hooks/exhaustive-deps */

import * as React from "react";
import { message } from "antd";
import {
  getBalancesForToken,
  getEligibleAddresses
} from "../../../utils/dividends/createDividends";
import retry from "../../../utils/retry";
import { WalletContext } from "../../../utils/context";
import { getEligibleSlpDividendReceivers } from "../../../utils/slpDividends/createSlpDividends";

export const useDividendsStats = ({
  token,
  sendingToken,
  sendingTokenAmount,
  bchAmount,
  setLoading,
  advancedOptions,
  disabled
}) => {
  const { wallet, balances, slpBalancesAndUtxos } = React.useContext(WalletContext);
  const [stats, setStats] = React.useState({
    tokens: 0,
    holders: 0,
    balances: null,
    eligibles: 0,
    txFee: 0,
    bchMaxAmount: 0
  });

  React.useEffect(() => {
    if (disabled === true)
      setStats({ tokens: 0, holders: 0, balances: null, eligibles: 0, txFee: 0, bchMaxAmount: 0 });
  }, [disabled]);

  React.useEffect(() => {
    if (!disabled) {
      if (!token) {
        return;
      }
      setLoading(true);
      retry(() => getBalancesForToken(token.tokenId))
        .then(balancesForToken => {
          setStats({
            ...stats,
            tokens: balancesForToken.totalBalance,
            holders: balancesForToken.length ? balancesForToken.length : 0,
            balances: balancesForToken,
            txFee: 0
          });
        })
        .catch(() => null)
        .finally(() => setLoading(false));
    }
  }, [token, disabled]);

  // max amount
  React.useEffect(() => {
    if (!disabled) {
      if (!stats.balances || !balances.totalBalance || !slpBalancesAndUtxos || !token) {
        return;
      }

      try {
        const { txFee } = getEligibleAddresses(
          wallet,
          stats.balances,
          balances.totalBalance,
          slpBalancesAndUtxos.nonSlpUtxos,
          advancedOptions,
          token.tokenId
        );
        const bchMaxAmount = (balances.totalBalance - txFee).toFixed(8);
        setStats(stats => ({ ...stats, bchMaxAmount, txFee }));
      } catch (error) {}
    }
  }, [wallet, balances, stats.balances, slpBalancesAndUtxos, token, advancedOptions, disabled]);

  // eligible addresses given a bch amount
  React.useEffect(() => {
    if (!disabled) {
      if (!token) {
        return;
      }

      try {
        if (!Number.isNaN(Number(bchAmount)) && bchAmount > 0) {
          const { addresses, txFee } = getEligibleAddresses(
            wallet,
            stats.balances,
            bchAmount,
            slpBalancesAndUtxos.nonSlpUtxos,
            advancedOptions,
            token.tokenId
          );

          setStats(stats => ({ ...stats, eligibles: addresses.length, txFee }));
        } else {
          setStats(stats => ({ ...stats, eligibles: 0, txFee: 0 }));
        }
      } catch (error) {
        console.error(error);
        message.error("Unable to calculate eligible addresses due to network errors");
      }
    }
  }, [
    wallet,
    balances,
    stats.balances,
    slpBalancesAndUtxos,
    advancedOptions,
    token,
    bchAmount,
    disabled
  ]);

  // eligible addresses given a sending token amount
  React.useEffect(() => {
    if (!disabled) {
      if (!token || !sendingToken) {
        return;
      }

      try {
        if (sendingTokenAmount > 0) {
          const { receivers, estimatedTotalFee } = getEligibleSlpDividendReceivers(
            wallet,
            stats.balances,
            sendingTokenAmount,
            slpBalancesAndUtxos.nonSlpUtxos,
            advancedOptions,
            sendingToken,
            token
          );

          setStats(stats => ({
            ...stats,
            eligibles: receivers.length,
            txFee: Number(estimatedTotalFee.toFixed(8))
          }));
        } else {
          setStats(stats => ({ ...stats, eligibles: 0, txFee: 0 }));
        }
      } catch (error) {
        console.error(error);
        message.error("Unable to calculate eligible addresses due to network errors");
      }
    }
  }, [
    wallet,
    balances,
    stats.balances,
    slpBalancesAndUtxos,
    advancedOptions,
    token,
    sendingToken,
    sendingTokenAmount,
    disabled
  ]);

  return {
    stats,
    setLoading
  };
};
