import * as React from "react";
import { OnBoarding } from "./OnBoarding";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";

const ViewOnBoarding = () => (
  <ErrorBoundary>
    <OnBoarding />
  </ErrorBoundary>
);

export default ViewOnBoarding;
