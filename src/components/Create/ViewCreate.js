import * as React from "react";
import Create from "./Create";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const ViewCreate = () => (
  <ErrorBoundary>
    <Create />
  </ErrorBoundary>
);

export default ViewCreate;
