import * as React from "react";
import { debounce } from "lodash";
import handleError from "./handleError";

const useAsyncError = ({ shouldFallback }) => {
  const [err, setError] = React.useState();
  return React.useCallback(
    e =>
      setError(() => {
        console.log("e :", e.stack);
        throw new Error(
          JSON.stringify({
            message: handleError(e),
            stack: e.stack,
            error: e,
            fallback: shouldFallback
          })
        );
      }),
    [setError]
  );
};
export default useAsyncError;
