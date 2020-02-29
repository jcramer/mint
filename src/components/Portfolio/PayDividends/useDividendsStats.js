/* eslint-disable react-hooks/exhaustive-deps */

import * as React from "react";
import { message } from "antd";
import { getBalancesForToken, getEligibleAddresses } from "../../../utils/dividends/sendDividends";
import retry from "../../../utils/retry";
import { WalletContext } from "../../../utils/context";

export const useDividendsStats = ({ token, amount, setLoading, advancedOptions, disabled }) => {
  const { wallet, balances, slpBalancesAndUtxos } = React.useContext(WalletContext);
  const [stats, setStats] = React.useState({
    tokens: 0,
    holders: 0,
    balances: null,
    eligibles: 0,
    txFee: 0,
    maxAmount: 0
  });

  React.useEffect(() => {
    if (disabled === true)
      setStats({ tokens: 0, holders: 0, balances: null, eligibles: 0, txFee: 0, maxAmount: 0 });
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
        const maxAmount = (balances.totalBalance - txFee).toFixed(8);
        setStats(stats => ({ ...stats, maxAmount }));
      } catch (error) {}
    }
  }, [wallet, balances, stats.balances, slpBalancesAndUtxos, token, advancedOptions, disabled]);

  // eligible addresses to the amount
  React.useEffect(() => {
    if (!disabled) {
      if (!token) {
        return;
      }

      try {
        if (!Number.isNaN(Number(amount)) && amount > 0) {
          const { addresses, txFee } = getEligibleAddresses(
            wallet,
            stats.balances,
            amount,
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
    amount,
    disabled
  ]);

  return {
    stats,
    setLoading
  };
};
