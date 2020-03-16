import * as React from "react";
import TokenHistory from "./TokenHistory";
import ErrorBoundary from "../../ErrorBoundary/ErrorBoundary";

const ViewTokenHistory = ({ history, wallet }) => (
  <ErrorBoundary>
    <TokenHistory history={history} wallet={wallet} />
  </ErrorBoundary>
);

export default ViewTokenHistory;
