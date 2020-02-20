import React, { useState } from "react";
import styled from "styled-components";
import Img from "react-image";
import makeBlockie from "ethereum-blockies-base64";
import { WalletContext } from "../../../utils/context";
import { sendDividends, DUST } from "../../../utils/sendDividends";
import {
  Card,
  Icon,
  Form,
  Button,
  Spin,
  notification,
  Badge,
  Tooltip,
  message,
  Alert,
  Input
} from "antd";
import { Row, Col } from "antd";
import Paragraph from "antd/lib/typography/Paragraph";
import { FormItemWithMaxAddon } from "../EnhancedInputs";
import { AdvancedOptions } from "./AdvancedOptions";
import { QRCode } from "../../Common/QRCode";
import withSLP, { getRestUrl } from "../../../utils/withSLP";
import { useDividendsStats } from "./useDividendsStats";

const StyledPayDividends = styled.div`
  * {
    color: rgb(62, 63, 66) !important;
  }
  .anticon-close,
  .ant-alert-close-icon {
    margin-top: -7px;
    margin-right: -7px;
  }
  .ant-alert-message {
    display: flex;
    align-items: center;
    text-align: left;
    word-break: break-word;

    @media screen and (max-width: 600px) {
      font-size: 10px;
      word-break: break-word;
    }
    .anticon {
      margin-right: 7px;
      font-size: 18px;
    }
  }
  @media screen and (max-width: 600px) {
    .anticon-close,
    .ant-alert-close-icon {
      font-size: 7px !important;
    }
  }
`;

const StyledStat = styled.div`
  font-size: 12px;

  .ant-badge sup {
    background: #fbfcfd;
    color: rgba(255, 255, 255, 0.65);
    box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.35);
  }
`;

export const StyledButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const SLP_TOKEN_ICONS_URL = "https://tokens.bch.sx/64";

const PayDividends = (SLP, { token, onClose, bordered = false }) => {
  const { wallet, balances, slpBalancesAndUtxos } = React.useContext(WalletContext);
  const [formData, setFormData] = useState({
    dirty: false,
    amount: "",
    tokenId: token ? token.tokenId : null,
    maxAmount: 0,
    maxAmountChecked: false
  });
  const [advancedOptions, setAdvancedOptions] = useState({
    ignoreOwnAddress: true,
    addressesToExclude: [{ address: "", valid: null }]
  });
  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(token);
  const [tokenNotFound, setTokenNotFound] = useState(false);
  const [lastSearchedTokenId, setLastSearchedTokenId] = useState("");

  const { stats } = useDividendsStats({
    token: tokenInfo,
    amount: formData.amount,
    setLoading,
    advancedOptions,
    disabled: !/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !tokenInfo
  });

  const submitEnabled =
    /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
    formData.amount >= DUST &&
    (!advancedOptions ||
      !advancedOptions.opReturnMessage ||
      advancedOptions.opReturnMessage.length <= 60) &&
    tokenInfo;

  if (formData.maxAmountChecked && stats.maxAmount !== formData.amount) {
    setFormData({
      ...formData,
      amount: stats.maxAmount
    });
  }

  async function submit() {
    setFormData({
      ...formData,
      dirty: true
    });

    if (!submitEnabled) {
      return;
    }

    setLoading(true);
    const { amount } = formData;
    try {
      const link = await sendDividends(wallet, slpBalancesAndUtxos.nonSlpUtxos, advancedOptions, {
        value: amount,
        tokenId: tokenInfo.tokenId
      });

      if (!link) {
        setLoading(false);

        return notification.info({
          message: "Info",
          description: (
            <Paragraph>No token holder with sufficient balance to receive dividends.</Paragraph>
          ),
          duration: 2
        });
      }

      notification.success({
        message: "Success",
        description: (
          <a href={link} target="_blank" rel="noopener noreferrer">
            <Paragraph>Transaction successful. Click or tap here for more details</Paragraph>
          </a>
        ),
        duration: 2
      });

      setLoading(false);
      if (onClose) {
        onClose();
      }
    } catch (e) {
      let message;

      if (/don't have the minting baton/.test(e.message)) {
        message = e.message;
      } else if (/Invalid BCH address/.test(e.message)) {
        message = "Invalid BCH address";
      } else if (/64: dust/.test(e.message)) {
        message = "Small amount";
      } else if (/Balance 0/.test(e.message)) {
        message = "Balance of sending address is zero";
      } else if (/Insufficient funds/.test(e.message)) {
        message = "Insufficient funds.";
      } else if (!e.error) {
        message = `Transaction failed: no response from ${getRestUrl()}.`;
      } else if (/Could not communicate with full node or other external service/.test(e.error)) {
        message = "Could not communicate with API. Please try again.";
      } else {
        message = e.message || e.error || JSON.stringify(e);
      }

      notification.error({
        message: "Error",
        description: message,
        duration: 2
      });
      console.error(e);
      setLoading(false);
    }
  }

  const handleChange = e => {
    const { value, name } = e.target;
    setFormData(data => ({ ...data, dirty: true, maxAmountChecked: false, [name]: value }));
  };

  const search = async () => {
    const tokenId = formData.tokenId;
    if (/^[A-Fa-f0-9]{64}$/g.test(tokenId)) {
      setLoading(true);
      try {
        const tokenDetails = await SLP.Utils.list(tokenId);
        if (tokenDetails.id !== "not found") {
          setTokenInfo({ ...tokenDetails, tokenId: tokenId, isFromInput: true });
          setTokenNotFound(false);
          setFormData(data => ({
            ...data,
            dirty: false
          }));
        } else {
          setTokenNotFound(true);
          setTokenInfo(undefined);
          setLastSearchedTokenId(tokenId);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    } else {
      setLastSearchedTokenId(tokenId ? tokenId : " ");
    }
  };

  const onMaxAmount = async () => {
    setLoading(true);

    try {
      setFormData({
        ...formData,
        maxAmountChecked: true,
        amount: stats.maxAmount
      });
    } catch (err) {
      message.error("Unable to calculate the max amount due to network errors");
    }

    setLoading(false);
  };

  const setAdvancedOptionsAndCalcEligibles = options => {
    setFormData({
      ...formData,
      dirty: true
    });
    setAdvancedOptions(options);
  };

  const tokenIdRef = React.useRef(null);

  return (
    <StyledPayDividends>
      <Row type="flex" className="dividends">
        <Col span={24}>
          <Spin spinning={loading}>
            <Card
              title={
                <h2>
                  <Icon type="dollar-circle" theme="filled" /> Pay Dividends
                </h2>
              }
              bordered={bordered}
            >
              {!balances.totalBalance ? (
                <Row justify="center" type="flex">
                  <Col>
                    <br />
                    <StyledButtonWrapper>
                      <>
                        <Paragraph>
                          You currently have 0 BCH. Deposit some funds to use this feature.
                        </Paragraph>
                        <Paragraph>
                          <QRCode id="borderedQRCode" address={wallet.Path145.cashAddress} />
                        </Paragraph>
                      </>
                    </StyledButtonWrapper>
                  </Col>
                </Row>
              ) : (
                <>
                  <br />
                  <Row type="flex" style={{ justifyContent: "center" }}>
                    {tokenInfo && tokenInfo.name && tokenInfo.tokenId && tokenInfo.isFromInput && (
                      <Col>
                        <div style={{ marginRight: "10px" }}>
                          <Img
                            src={`${SLP_TOKEN_ICONS_URL}/${tokenInfo.tokenId}.png`}
                            unloader={
                              <img
                                alt={`identicon of tokenId ${tokenInfo.tokenId} `}
                                height="60"
                                width="60"
                                style={{ borderRadius: "50%" }}
                                key={`identicon-${tokenInfo.tokenId}`}
                                src={makeBlockie(tokenInfo.tokenId)}
                              />
                            }
                          />
                          <p>{tokenInfo.name}</p>
                        </div>
                      </Col>
                    )}
                  </Row>
                  <Row
                    type="flex"
                    style={{
                      justifyContent: !tokenInfo || tokenInfo.isFromInput ? "center" : "inherit"
                    }}
                  >
                    <Col>
                      <Tooltip title="Circulating Supply">
                        <StyledStat>
                          <Icon type="gold" />
                          &nbsp;
                          <Badge
                            count={new Intl.NumberFormat("en-US").format(stats.tokens)}
                            overflowCount={Number.MAX_VALUE}
                            showZero
                          />
                          <Paragraph>Tokens</Paragraph>
                        </StyledStat>
                      </Tooltip>
                    </Col>
                    &nbsp; &nbsp; &nbsp;
                    <Col>
                      <Tooltip title="Addresses with at least one token">
                        <StyledStat>
                          <Icon type="team" />
                          &nbsp;
                          <Badge
                            count={new Intl.NumberFormat("en-US").format(stats.holders)}
                            overflowCount={Number.MAX_VALUE}
                            showZero
                          />
                          <Paragraph>Holders</Paragraph>
                        </StyledStat>
                      </Tooltip>
                    </Col>
                    &nbsp; &nbsp; &nbsp;
                    <Col>
                      <Tooltip
                        title={`To be eligible, addresses must have an SLP balance such that their proportional share of your dividend payment is greater than ${DUST} BCH`}
                      >
                        <StyledStat>
                          <Icon type="usergroup-add" />
                          &nbsp;
                          <Badge
                            count={new Intl.NumberFormat("en-US").format(stats.eligibles)}
                            overflowCount={Number.MAX_VALUE}
                            showZero
                          />
                          <Paragraph>Eligibles</Paragraph>
                        </StyledStat>
                      </Tooltip>
                    </Col>
                  </Row>
                  <Row type="flex">
                    <Col span={24}>
                      <Form style={{ width: "auto", marginBottom: "1em" }} noValidate>
                        {!token && (
                          <>
                            <Form.Item
                              validateStatus={
                                formData.dirty &&
                                (!tokenInfo && lastSearchedTokenId) &&
                                (!/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) ||
                                  (tokenNotFound &&
                                    lastSearchedTokenId === formData.tokenId &&
                                    /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId))) &&
                                !loading
                                  ? "error"
                                  : ""
                              }
                              help={
                                formData.dirty &&
                                (!tokenInfo && lastSearchedTokenId) &&
                                (!/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) ||
                                  (tokenNotFound &&
                                    lastSearchedTokenId === formData.tokenId &&
                                    /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId))) &&
                                !loading
                                  ? tokenNotFound &&
                                    lastSearchedTokenId === formData.tokenId &&
                                    /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId)
                                    ? "Token not found. Try a different Token ID."
                                    : "Invalid Token ID"
                                  : /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) && !tokenInfo
                                  ? "Click on search"
                                  : ""
                              }
                              required
                            >
                              <Input
                                prefix={<Icon type="block" />}
                                placeholder="Token ID"
                                name="tokenId"
                                onChange={e => handleChange(e)}
                                disabled={!tokenNotFound && tokenInfo}
                                ref={tokenIdRef}
                                required
                                autoComplete="off"
                                type="text"
                                addonAfter={
                                  !tokenNotFound && tokenInfo ? (
                                    <Button
                                      ghost
                                      type="link"
                                      icon="edit"
                                      onClick={e => {
                                        setTokenNotFound(false);
                                        setTokenInfo(undefined);

                                        tokenIdRef.current.handleReset(e);
                                        setFormData(data => ({
                                          ...data,
                                          dirty: false,
                                          maxAmountChecked: false,
                                          tokenId: null,
                                          maxAmount: 0,
                                          amount: ""
                                        }));
                                        setLastSearchedTokenId("");
                                        setAdvancedOptions({
                                          ignoreOwnAddress: true,
                                          addressesToExclude: [{ address: "", valid: null }]
                                        });
                                      }}
                                    />
                                  ) : (
                                    <Button
                                      ghost
                                      type="link"
                                      icon="search"
                                      onClick={() => search()}
                                    />
                                  )
                                }
                              />
                            </Form.Item>
                          </>
                        )}
                        <FormItemWithMaxAddon
                          style={{ margin: 0 }}
                          disabled={!/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !tokenInfo}
                          validateStatus={
                            formData.dirty &&
                            !submitEnabled &&
                            /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
                            tokenInfo &&
                            !loading
                              ? "error"
                              : ""
                          }
                          help={
                            formData.dirty &&
                            !submitEnabled &&
                            /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
                            tokenInfo &&
                            !loading &&
                            Number(formData.amount) < DUST
                              ? `Insufficient BCH, must have at least ${DUST} BCH
                              not associated with SLP utxos to send BCH.
                              Please deposit additional BCH.`
                              : ""
                          }
                          onMax={onMaxAmount}
                          inputProps={{
                            suffix: "BCH",
                            name: "amount",
                            placeholder: "Amount",
                            onChange: e => handleChange(e),
                            required: true,
                            value: formData.amount,
                            disabled: !/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !tokenInfo
                          }}
                        />
                      </Form>
                    </Col>
                    <Col span={24}>
                      <Alert
                        style={{ marginBottom: 14, maxWidth: "100%" }}
                        message={
                          <>
                            <Icon type="info-circle" />
                            Token holder address and balance list is provided by{" "}
                            {`${getRestUrl()}slp/balancesForToken`} and represents the latest
                            mempool state available to the API.
                          </>
                        }
                        type="info"
                        closable
                      />
                    </Col>
                    <Col span={24}>
                      <AdvancedOptions
                        advancedOptions={advancedOptions}
                        setAdvancedOptions={setAdvancedOptionsAndCalcEligibles}
                        disabled={!/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !tokenInfo}
                      />
                    </Col>
                    <Col span={24}>
                      <div style={{ paddingTop: "12px" }}>
                        <Button disabled={!submitEnabled} onClick={() => submit()}>
                          Pay Dividends
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </>
              )}
            </Card>
          </Spin>
        </Col>
      </Row>
    </StyledPayDividends>
  );
};

export default withSLP(PayDividends);
