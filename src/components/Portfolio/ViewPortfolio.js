import * as React from "react";
import Portfolio from "./Portfolio";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const ViewPortfolio = props => (
  <ErrorBoundary>
    <Portfolio {...props} />
  </ErrorBoundary>
);

export default ViewPortfolio;
