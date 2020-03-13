import * as React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import View from "./components/View/View";
import { WalletProvider } from "./utils/context";

ReactDOM.render(
  <WalletProvider>
    <View />
  </WalletProvider>,
  document.getElementById("root")
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/serviceWorker.js").catch(() => null)
  );
}

if (module.hot) {
  module.hot.accept();
}
