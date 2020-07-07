import React from "react";
import { Switch, Route, Redirect } from "react-router";
import SendTokens from "./SendTokens/SendTokens";

export default () => (
  <Switch>
    <Route path="/post-office/send-tokens">
      <SendTokens />
    </Route>
    <Redirect to="/" />
  </Switch>
);
