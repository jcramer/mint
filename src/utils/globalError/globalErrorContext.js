import React, { useState, useCallback } from "react";
import { debounce } from "lodash";
import { notification } from "antd";
import handleError from "./handleError";

export const GlobalErrorContext = React.createContext({
  error: null,
  addError: () => {},
  showNotifications: () => null
});

const GlobalErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);

  const contextValue = {
    error,
    addError: useCallback(debounce(e => setError(e))),
    showNotifications: useCallback(
      () =>
        error &&
        notification.error({
          message: "Error",
          description: handleError(error),
          duration: 2
        })
    )
  };

  return <GlobalErrorContext.Provider value={contextValue}>{children}</GlobalErrorContext.Provider>;
};

export default GlobalErrorProvider;
