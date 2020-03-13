import * as React from "react";
import SendBCH from "./SendBCH";
import ErrorBoundary from "../../ErrorBoundary/ErrorBoundary";

const ViewSendBCH = ({ onClose, outerAction }) => (
  <ErrorBoundary>
    <SendBCH onClose={onClose} outerAction={outerAction} />
  </ErrorBoundary>
);

export default ViewSendBCH;
