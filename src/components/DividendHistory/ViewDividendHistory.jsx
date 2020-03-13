import * as React from "react";
import DividendHistory from "./DividendHistory";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const ViewDividendHistory = () => (
  <ErrorBoundary>
    <DividendHistory />
  </ErrorBoundary>
);

export default ViewDividendHistory;
