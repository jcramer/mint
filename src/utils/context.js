import React from "react";
import { Spin } from "antd";
import { useWallet } from "./useWallet";
import { Icon } from "antd";

export const WalletContext = React.createContext();

export const WalletProvider = ({ children }) => {
  const value = useWallet();

  return (
    <WalletContext.Provider value={value}>
      {
        <Spin
          size="large"
          indicator={<Icon type="loading" spin />}
          spinning={value.error || value.loading}
        >
          {children}
        </Spin>
      }
    </WalletContext.Provider>
  );
};
