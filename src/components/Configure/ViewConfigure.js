import * as React from "react";
import Configure from "./Configure";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const ViewConfigure = () => (
  <ErrorBoundary>
    <Configure />
  </ErrorBoundary>
);

export default ViewConfigure;
