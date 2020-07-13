import React, { useState } from "react";
import styled from "styled-components";
import {
  Row,
  Col,
  Icon,
  Avatar,
  Empty,
  Alert,
  notification,
  Radio,
  Spin,
  Collapse,
  Switch
} from "antd";
import { EnhancedCard } from "./EnhancedCard";
import { WalletContext } from "../../utils/context";
import { Meta } from "antd/lib/list/Item";
import Img from "react-image";
import makeBlockie from "ethereum-blockies-base64";
import Mint from "./Mint/Mint";
import Transfer from "./Transfer/Transfer";
import PayDividends from "./PayDividends/PayDividends";
import Burn from "./Burn/Burn";
import SendBCH from "./SendBCH/SendBCH";
import { PlaneIcon, HammerIcon, FireIcon } from "../Common/CustomIcons";
import Paragraph from "antd/lib/typography/Paragraph";
import { OnBoarding } from "../OnBoarding/OnBoarding";
import getTokenTransactionHistory from "../../utils/getTokenTransactionHistory";
import bchFlagLogo from "../../assets/4-bitcoin-cash-logo-flag.png";

export const SLP_TOKEN_ICONS_URL = "https://tokens.bch.sx/64";
export const BITCOIN_DOT_COM_ICONS_URL = "https://tokens.bitcoin.com/64";

export const StyledCollapse = styled(Collapse)`
  background: #fbfcfd !important;
  border: 1px solid #eaedf3 !important;
  margin-top: 12px !important;
  .ant-collapse-content {
    border: 1px solid #eaedf3;
    border-top: none;
  }

  .ant-collapse-item {
    border-bottom: none !important;
  }
  .ant-collapse-header {
    color: rgb(62, 63, 66) !important;
  }
  .ant-typography {
    color: rgb(62, 63, 66);
    font-weight: bold;
  }
`;

const StyledSwitch = styled(Col)`
  text-align: left;
  margin-top: 12px;
  color: rgb(62, 63, 66);

  @media (max-width: 768px) {
    text-align: center;
  }
`;

export default () => {
  const ContextValue = React.useContext(WalletContext);
  const { wallet, tokens, loading, balances, slpBalancesAndUtxos } = ContextValue;
  const [selectedToken, setSelectedToken] = useState(null);
  const [action, setAction] = useState(null);

  const [loadingTokenHistory, setLoadingTokenHistory] = useState(false);
  const [tokenCardAction, setTokenCardAction] = useState("details");
  const [history, setHistory] = useState(null);
  const [outerAction, setOuterAction] = useState(false);
  const [showArchivedTokens, setShowArchivedTokens] = useState(false);

  const getImgs = doc => {
    return Array.from(doc.images)
      .filter(
        img => img.currentSrc.includes("tokens.bch.sx") || img.currentSrc.includes("https://icons.")
      )
      .map(
        img =>
          img.currentSrc
            .split("/")
            .slice()
            .reverse()[0]
            .split(".")[0]
      );
  };

  React.useEffect(() => {
    const tokenIconIds = getImgs(document);
    if (tokenIconIds.length) {
      tokenIconIds.map(id => window.localStorage.removeItem(id));
    }
  }, [tokens]);

  const isModalOpen = (action, selectedToken) => action === "sendBCH" || selectedToken !== null;

  React.useEffect(() => {
    document.body.style.overflow = isModalOpen(action, selectedToken) ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [action, selectedToken]);

  const getTokenHistory = async tokenInfo => {
    setLoadingTokenHistory(true);
    try {
      const resp = await getTokenTransactionHistory(
        wallet.slpAddresses,
        tokenInfo,
        slpBalancesAndUtxos.slpUtxos.filter(utxo => utxo.slpData.tokenId === tokenInfo.tokenId)
      );
      setHistory(resp);
    } catch (err) {
      const message = err.message || err.error || JSON.stringify(err);

      notification.error({
        message: "Error",
        description: message,
        duration: 2
      });
      console.error(err);
    }

    setLoadingTokenHistory(false);
  };

  const handleChangeAction = (e, tokenId) => {
    setAction(null);
    if (tokenCardAction === "details") {
      setTokenCardAction("history");
      getTokenHistory(tokens.find(token => token.tokenId === tokenId).info);
    } else if (tokenCardAction === "history") {
      setTokenCardAction("details");
    } else if (tokenCardAction === null) {
      if (e.target.value === "details") {
        setTokenCardAction("details");
      } else if (e.target.value === "history") {
        setTokenCardAction("history");
        getTokenHistory(tokens.find(token => token.tokenId === tokenId).info);
      }
    }
  };
  const onClose = () => {
    setSelectedToken(null);
    setAction(null);
    setLoadingTokenHistory(false);
    setTokenCardAction("details");
    setHistory(null);
  };

  const renderActions = (action, setAction, token) => {
    const { hasBaton, balance } = token;
    const hasBalance = balance && balance.gt(0);
    let actions = [
      <span
        onClick={() => {
          setAction("dividends");
          setTokenCardAction(tokenCardAction !== null ? null : tokenCardAction);
        }}
      >
        <Icon style={{ fontSize: "18px" }} type="dollar-circle" theme="filled" />
        {hasBaton && hasBalance ? "Dividends" : "Pay Dividends"}
      </span>
    ];

    if (hasBaton) {
      actions.unshift(
        <span
          onClick={() => {
            setAction("mint");
            setTokenCardAction(tokenCardAction !== null ? null : tokenCardAction);
          }}
        >
          <HammerIcon /> Mint
        </span>
      );
    }

    if (hasBalance) {
      actions.unshift(
        <span
          onClick={() => {
            setAction("transfer");
            setTokenCardAction(tokenCardAction !== null ? null : tokenCardAction);
          }}
        >
          <PlaneIcon />
          Send
        </span>
      );
    }

    return actions;
  };

  const renderBurnAction = tokenCardAction => {
    if (tokenCardAction) {
      return (
        <Paragraph
          onClick={() => {
            setAction("burn");
            setTokenCardAction(null);
          }}
        >
          <FireIcon style={{ marginBottom: "4px" }} /> Burn
        </Paragraph>
      );
    }

    return "";
  };
  return (
    <Row type="flex" gutter={32} style={{ position: "relative" }}>
      {!loading && wallet && (
        <Col style={{ marginTop: "8px" }} xl={8} lg={12} span={24}>
          <EnhancedCard
            style={{ marginTop: "8px", textAlign: "left" }}
            expand={!selectedToken && action === "sendBCH"}
            actions={[
              <span
                onClick={() => {
                  setAction("sendBCH");
                  setOuterAction(!outerAction);
                }}
              >
                <PlaneIcon />
                Send
              </span>
            ]}
            onClick={evt => {
              setAction("sendBCH");
              setSelectedToken(null);
              setOuterAction(!outerAction);
            }}
            renderExpanded={() =>
              action === "sendBCH" && <SendBCH onClose={onClose} outerAction={outerAction} />
            }
            onClose={onClose}
          >
            <Meta
              avatar={<Img src={bchFlagLogo} width="96" height="54" />}
              title={
                <div
                  style={{
                    float: "right"
                  }}
                >
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "rgb(62, 63, 66)" }}>
                    BCH
                  </div>
                  <div
                    style={{
                      color: "rgb(158, 160, 165)",
                      fontSize: "12px",
                      fontWeight: "500",
                      whiteSpace: "nowrap"
                    }}
                  >
                    Bitcoin Cash
                  </div>
                </div>
              }
              description={
                <div>
                  <div
                    style={{
                      color: "rgb(62, 63, 66)",
                      fontSize: "16px",
                      fontWeight: "bold"
                    }}
                  >
                    {balances.totalBalance ? balances.totalBalance.toFixed(8) : "0"}
                  </div>
                </div>
              }
            />
          </EnhancedCard>
        </Col>
      )}
      {loading
        ? Array.from({ length: 20 }).map((v, i) => (
            <Col key={i} style={{ marginTop: "8px" }} xl={8} lg={12} span={24}>
              <EnhancedCard loading bordered={false}>
                <Meta
                  avatar={
                    <Avatar src="https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png" />
                  }
                  title="Token symbol"
                  description="Token description"
                />
              </EnhancedCard>
            </Col>
          ))
        : null}
      {tokens.length
        ? tokens
            .filter(
              element =>
                (!showArchivedTokens && element.balance && element.balance.gt(0)) ||
                showArchivedTokens
            )
            .map(token => (
              <Col
                style={{ marginTop: "8px" }}
                xl={8}
                lg={12}
                sm={12}
                span={24}
                key={`col-${token.tokenId}`}
              >
                <EnhancedCard
                  token={token}
                  loading={!token.info}
                  expand={selectedToken && token.tokenId === selectedToken.tokenId}
                  onClick={() =>
                    setSelectedToken(
                      !selectedToken || token.tokenId !== selectedToken.tokenId ? token : null
                    )
                  }
                  key={`card-${token.tokenId}`}
                  style={{ marginTop: "8px", textAlign: "left" }}
                  onClose={onClose}
                  actions={renderActions(action, setAction, token)}
                  renderExpanded={() => (
                    <Spin spinning={loadingTokenHistory}>
                      <Radio.Group
                        defaultValue="details"
                        onChange={e => handleChangeAction(e, selectedToken.tokenId)}
                        value={tokenCardAction}
                        style={{
                          width: "100%",
                          textAlign: "center",
                          marginTop: "0px",
                          marginBottom: "18px"
                        }}
                        size="small"
                        buttonStyle="solid"
                      >
                        <Radio.Button
                          style={{
                            borderRadius: "19.5px",
                            height: "40px",
                            width: "50%",
                            fontSize: "16px"
                          }}
                          value="details"
                          onClick={e => handleChangeAction(e, selectedToken.tokenId)}
                        >
                          <Icon style={{ color: "#fff" }} type="info-circle" /> Details
                        </Radio.Button>
                        <Radio.Button
                          style={{
                            borderRadius: "19.5px",
                            height: "40px",
                            width: "50%",
                            fontSize: "16px"
                          }}
                          value="history"
                          onClick={e => handleChangeAction(e, selectedToken.tokenId)}
                        >
                          <Icon style={{ color: "#fff" }} type="history" /> History
                        </Radio.Button>
                      </Radio.Group>
                      {!loadingTokenHistory &&
                      selectedToken &&
                      token.tokenId === selectedToken.tokenId &&
                      tokenCardAction === "details" ? (
                        <>
                          <Alert
                            message={
                              <div>
                                <Paragraph>
                                  <Icon type="info-circle" /> &nbsp; Token properties
                                </Paragraph>
                                {Object.entries(token.info || {}).map(entry => (
                                  <Paragraph
                                    key={`paragraph-${token.tokenId}-${entry[0]}`}
                                    small
                                    copyable={{ text: entry[1] }}
                                    ellipsis
                                    style={{ whiteSpace: "nowrap", maxWidth: "100%" }}
                                  >
                                    {entry[0]}: {entry[1]}
                                  </Paragraph>
                                ))}
                              </div>
                            }
                            type="warning"
                            style={{ marginTop: 4 }}
                          />

                          <StyledCollapse>
                            <Collapse.Panel header="Advanced options">
                              {renderBurnAction("details")}
                            </Collapse.Panel>
                          </StyledCollapse>
                        </>
                      ) : null}

                      {!loadingTokenHistory &&
                      selectedToken &&
                      token.tokenId === selectedToken.tokenId &&
                      tokenCardAction === "history" ? (
                        <>
                          <p>Transaction History (max 30)</p>
                          {history.map(el => (
                            <div
                              key={`history-${el.txid}`}
                              style={{
                                background:
                                  el.balance > 0
                                    ? el.detail.transactionType === "BURN"
                                      ? "#FDF1F0"
                                      : "#D4EFFC"
                                    : el.detail.transactionType.includes("BURN")
                                    ? "#FDF1F0"
                                    : "#ffd59a",
                                color: "black",
                                borderRadius: "12px",
                                marginBottom: "18px",
                                padding: "8px",
                                boxShadow: "6px 6px #888888",
                                width: "97%"
                              }}
                            >
                              {el.detail.transactionType !== "BURN_ALL" ? (
                                <a
                                  href={`https://explorer.bitcoin.com/bch/tx/${el.txid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <p>
                                    {el.balance > 0
                                      ? el.detail.transactionType === "GENESIS"
                                        ? "Genesis"
                                        : el.detail.transactionType === "MINT"
                                        ? "Mint"
                                        : el.detail.transactionType === "BURN"
                                        ? "Burn"
                                        : "Received"
                                      : el.detail.transactionType === "BURN_BATON"
                                      ? "Burn Baton"
                                      : "Sent"}
                                  </p>
                                  <p>{el.date.toLocaleString()}</p>

                                  {el.detail.transactionType === "BURN" &&
                                    (el.detail.burnAmount ? (
                                      <p>{`${el.detail.burnAmount} ${el.detail.symbol} burned`}</p>
                                    ) : (
                                      <p>Burn amount could not be found for this transaction</p>
                                    ))}

                                  {el.detail.transactionType !== "BURN_BATON" && (
                                    <p>{`${
                                      el.balance > 0 && el.detail.transactionType !== "BURN"
                                        ? "+"
                                        : ""
                                    }${el.balance} ${el.detail.symbol} ${
                                      el.detail.transactionType === "BURN" ? "left" : ""
                                    }`}</p>
                                  )}

                                  <Paragraph
                                    small
                                    ellipsis
                                    style={{
                                      whiteSpace: "nowrap",
                                      color: "black",
                                      maxWidth: "90%"
                                    }}
                                  >
                                    {el.txid}
                                  </Paragraph>
                                  <p>{`Confirmations: ${el.confirmations}`}</p>
                                </a>
                              ) : (
                                <p>Burn All</p>
                              )}
                            </div>
                          ))}
                          <a
                            href={`https://explorer.bitcoin.com/bch/address/${wallet.Path245.slpAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p>Full History</p>
                          </a>
                        </>
                      ) : null}

                      {selectedToken && action === "mint" && tokenCardAction === null ? (
                        <Mint token={selectedToken} onClose={onClose} />
                      ) : null}
                      {selectedToken && action === "transfer" && tokenCardAction === null ? (
                        <Transfer token={selectedToken} onClose={onClose} />
                      ) : null}
                      {selectedToken && action === "dividends" && tokenCardAction === null ? (
                        <PayDividends token={selectedToken} onClose={onClose} />
                      ) : null}
                      {selectedToken && action === "burn" && tokenCardAction === null ? (
                        <Burn
                          token={selectedToken}
                          avatar={
                            <Img
                              heigh={16}
                              width={16}
                              src={[
                                `${BITCOIN_DOT_COM_ICONS_URL}/${token.tokenId}.png`,
                                `${SLP_TOKEN_ICONS_URL}/${token.tokenId}.png`
                              ]}
                              unloader={
                                <img
                                  alt=""
                                  heigh={16}
                                  width={16}
                                  style={{
                                    borderRadius: window.localStorage.getItem(token.tokenId)
                                      ? null
                                      : "50%"
                                  }}
                                  src={
                                    window.localStorage.getItem(token.tokenId) ||
                                    makeBlockie(token.tokenId)
                                  }
                                />
                              }
                            />
                          }
                          onClose={onClose}
                        />
                      ) : null}
                    </Spin>
                  )}
                >
                  <Meta
                    avatar={
                      <Img
                        src={[
                          `${BITCOIN_DOT_COM_ICONS_URL}/${token.tokenId}.png`,
                          `${SLP_TOKEN_ICONS_URL}/${token.tokenId}.png`
                        ]}
                        unloader={
                          <img
                            alt={`identicon of tokenId ${token.tokenId} `}
                            heigh="60"
                            width="60"
                            style={{
                              borderRadius: window.localStorage.getItem(token.tokenId)
                                ? null
                                : "50%"
                            }}
                            key={`identicon-${token.tokenId}`}
                            src={
                              window.localStorage.getItem(token.tokenId) ||
                              makeBlockie(token.tokenId)
                            }
                          />
                        }
                      />
                    }
                    title={
                      <div
                        style={{
                          float: "right"
                        }}
                      >
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "rgb(62, 63, 66)"
                          }}
                        >
                          {token.info && token.info.symbol.toUpperCase()}
                        </div>
                        <div
                          style={{
                            color: "rgb(158, 160, 165)",
                            fontSize: "12px",
                            fontWeight: "500",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "210px"
                          }}
                        >
                          {token.info && token.info.name}
                        </div>
                        {/* {renderBurnAction(tokenCardAction)} */}
                      </div>
                    }
                    description={
                      <div>
                        <div
                          style={{
                            color: "rgb(62, 63, 66)",
                            fontSize: "16px",
                            fontWeight: "bold"
                          }}
                        >
                          {token.balance >= 0 ? token.balance.toString() : ""}
                        </div>
                      </div>
                    }
                  />
                </EnhancedCard>
              </Col>
            ))
        : null}
      {tokens.length ? (
        <StyledSwitch span={24}>
          <Switch onChange={checked => setShowArchivedTokens(checked)} /> Show Archived Tokens
        </StyledSwitch>
      ) : null}
      <Col span={24} style={{ marginTop: "8px" }}>
        {!loading && !tokens.length && wallet ? <Empty description="No tokens found" /> : null}
        {!loading && !tokens.length && !wallet ? <OnBoarding /> : null}
      </Col>
    </Row>
  );
};
