import * as React from "react";
import Dividends from "./Dividends";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const ViewDividends = () => (
  <ErrorBoundary>
    <Dividends />
  </ErrorBoundary>
);

export default ViewDividends;
