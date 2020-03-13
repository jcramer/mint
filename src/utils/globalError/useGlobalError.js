import { useContext } from "react";
import { GlobalErrorContext } from "./globalErrorContext";

const useGlobalError = () => {
  const { error, addError, showNotifications } = useContext(GlobalErrorContext);
  return { error, addError, showNotifications };
};

export default useGlobalError;
