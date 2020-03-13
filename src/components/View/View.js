import * as React from "react";
import RouteredApp from "../RouteredApp/RouteredApp";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const View = () => (
  <ErrorBoundary>
    <RouteredApp />
  </ErrorBoundary>
);

export default View;
