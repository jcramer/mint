import React, { useState } from "react";
import styled from "styled-components";
import Img from "react-image";
import makeBlockie from "ethereum-blockies-base64";
import { WalletContext } from "../../../utils/context";
import { createDividends } from "../../../utils/dividends/createDividends";
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
  Select,
  Radio
} from "antd";
import { Row, Col } from "antd";
import Paragraph from "antd/lib/typography/Paragraph";
import { FormItemWithMaxAddon, FormItemWithTokenSearchAddon } from "../EnhancedInputs";
import { AdvancedOptions } from "./AdvancedOptions";
import { QRCode } from "../../Common/QRCode";
import withSLP, { getRestUrl } from "../../../utils/withSLP";
import { useDividendsStats } from "./useDividendsStats";
import { useHistory } from "react-router";
import { DUST } from "../../../utils/sendBch";
import { createSlpDividends } from "../../../utils/slpDividends/createSlpDividends";
import SlpDividends from "../../../utils/slpDividends/slpDividends";
import { SLP_TOKEN_ICONS_URL } from "../Portfolio";

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

export const StyledSwitchWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
  flex: 1 1 0;

  .ant-radio-button-wrapper-checked {
    background: #fbfbfd !important;
  }
`;

export const StyledSelectWrapper = styled.div`
  .ant-select-selection {
    display: flex;
    align-items: center;
    height: 42px;
  }
  .ant-select-selection__placeholder,
  .ant-select-search__field__placeholder {
    overflow: unset;
  }
  position: relative;
  margin-bottom: 24px;
`;

export const StyledIconOnSelect = styled.div`
  display: inline-block;
  margin-right: 10px;
`;

export const Types = {
  BCH: 0,
  SLP: 1
};

const PayDividends = (SLP, { token: initialToken, onClose, bordered = false }) => {
  const { wallet, balances, slpBalancesAndUtxos, tokens } = React.useContext(WalletContext);
  const [formData, setFormData] = useState({
    dirty: false,
    bchAmount: "",
    tokenId: initialToken ? initialToken.tokenId : null,
    bchMaxAmount: 0,
    bchMaxAmountChecked: false,
    sendingTokenAmount: ""
  });
  const [advancedOptions, setAdvancedOptions] = useState({
    ignoreOwnAddress: true,
    addressesToExclude: [{ address: "", valid: null }]
  });
  const [type, setType] = useState(Types.BCH);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [sendingToken, setSendingToken] = useState();
  const history = useHistory();

  const { stats } = useDividendsStats({
    token,
    sendingToken,
    bchAmount: formData.bchAmount,
    sendingTokenAmount: formData.sendingTokenAmount,
    type,
    setLoading,
    advancedOptions,
    disabled: !/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !token
  });

  const validSlpDividend = sendingToken && formData.sendingTokenAmount >= 0;
  const validBchDividend =
    formData.bchAmount > DUST && (!stats.bchMaxAmount || formData.bchAmount <= stats.bchMaxAmount);
  const submitEnabled =
    /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
    ((type === Types.SLP && validSlpDividend) || (type === Types.BCH && validBchDividend)) &&
    (!advancedOptions ||
      !advancedOptions.opReturnMessage ||
      advancedOptions.opReturnMessage.length <= 60) &&
    token;

  const tokensAvaibleForAirdrop = tokens ? tokens.filter(t => t.balance > 0) : [];

  if (formData.bchMaxAmountChecked && stats.bchMaxAmount !== formData.bchAmount) {
    setFormData({
      ...formData,
      bchAmount: stats.bchMaxAmount
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
    const { bchAmount } = formData;
    try {
      if (type === Types.BCH) {
        await createDividends(
          wallet,
          stats.balances,
          slpBalancesAndUtxos.nonSlpUtxos,
          advancedOptions,
          {
            value: bchAmount,
            token: token
          }
        );
      } else {
        await createSlpDividends(
          wallet,
          stats.balances,
          [...slpBalancesAndUtxos.nonSlpUtxos, ...slpBalancesAndUtxos.slpUtxos],
          advancedOptions,
          {
            quantity: formData.sendingTokenAmount,
            receiverToken: token,
            sendingToken
          }
        );
      }

      notification.success({
        message: "Success",
        description: <Paragraph>Dividend payment successfully created.</Paragraph>,
        duration: 2
      });

      setLoading(false);
      history.push("/dividends-history");
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
      } else if (e.code === SlpDividends.Errors.NO_ELIGIBLE_RECEIVERS) {
        message = SlpDividends.ErrorMessages[SlpDividends.Errors.NO_ELIGIBLE_RECEIVERS];
      } else if (!e.error) {
        message = `Transaction failed: no response from ${getRestUrl()}.`;
      } else if (/Could not communicate with full node or other external service/.test(e.error)) {
        message = "Could not communicate with API. Please try again.";
      } else {
        message = e.message || e.error || JSON.stringify(e);
      }

      notification.error({
        message: "Error",
        description: <Paragraph>{message}</Paragraph>,
        duration: 2
      });
      console.error(e);
      setLoading(false);
    }
  }

  const handleChange = e => {
    const { value, name } = e.target;
    setFormData(data => ({ ...data, dirty: true, bchMaxAmountChecked: false, [name]: value }));
  };

  const onTokenFound = tokenDetails => {
    setToken({
      tokenId: tokenDetails.id,
      name: tokenDetails.name,
      info: tokenDetails,
      isFromInput: true
    });
    setFormData(data => ({
      ...data,
      tokenId: tokenDetails.id,
      dirty: false
    }));
  };

  const onMaxAmount = async () => {
    setLoading(true);

    try {
      setFormData({
        ...formData,
        bchMaxAmountChecked: true,
        bchAmount: stats.bchMaxAmount
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

  const onMaxSendingToken = () => {
    setFormData({ ...formData, sendingTokenAmount: sendingToken.balance, dirty: true });
  };

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
                    {token && token.name && token.tokenId && token.isFromInput && (
                      <Col>
                        <div style={{ marginRight: "10px" }}>
                          <Img
                            src={`${SLP_TOKEN_ICONS_URL}/${token.tokenId}.png`}
                            unloader={
                              <img
                                alt={`identicon of tokenId ${token.tokenId} `}
                                height="60"
                                width="60"
                                style={{ borderRadius: "50%" }}
                                key={`identicon-${token.tokenId}`}
                                src={makeBlockie(token.tokenId)}
                              />
                            }
                          />
                          <p>{token.name}</p>
                        </div>
                      </Col>
                    )}
                  </Row>
                  <Row
                    type="flex"
                    style={{
                      justifyContent: !token || token.isFromInput ? "center" : "inherit"
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
                    &nbsp; &nbsp; &nbsp;
                    <Col>
                      <Tooltip title={`Estimated BCH fee to pay all the eligible addresses`}>
                        <StyledStat>
                          <Icon type="minus-circle" />
                          &nbsp;
                          <Badge
                            count={stats.txFee || "0"}
                            overflowCount={Number.MAX_VALUE}
                            showZero
                          />
                          <Paragraph>Fee</Paragraph>
                        </StyledStat>
                      </Tooltip>
                    </Col>
                  </Row>
                  <Row type="flex">
                    <Col span={24}>
                      <Form style={{ width: "auto", marginBottom: "1em" }} noValidate>
                        {!token && (
                          <FormItemWithTokenSearchAddon
                            onResult={onTokenFound}
                            onLoading={setLoading}
                            onClear={() => {
                              setToken(undefined);
                              setFormData(data => ({
                                ...data,
                                dirty: false,
                                bchMaxAmountChecked: false,
                                tokenId: null,
                                bchMaxAmount: 0,
                                bchAmount: ""
                              }));
                              setAdvancedOptions({
                                ignoreOwnAddress: true,
                                addressesToExclude: [{ address: "", valid: null }]
                              });
                            }}
                            inputProps={{}}
                            required
                          />
                        )}
                        {type === Types.BCH ? (
                          <FormItemWithMaxAddon
                            style={{ margin: 0 }}
                            disabled={!/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !token}
                            validateStatus={
                              formData.dirty &&
                              !submitEnabled &&
                              /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
                              token &&
                              !loading
                                ? "error"
                                : ""
                            }
                            help={
                              formData.dirty &&
                              !submitEnabled &&
                              /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
                              token &&
                              !loading
                                ? `Must be greater than ${DUST} BCH ${
                                    stats.bchMaxAmount > 0
                                      ? `and lower or equal to ${stats.bchMaxAmount}`
                                      : ""
                                  }`
                                : ""
                            }
                            onMax={onMaxAmount}
                            inputProps={{
                              suffix: "BCH",
                              name: "bchAmount",
                              placeholder: "Amount",
                              onChange: e => handleChange(e),
                              required: true,
                              value: formData.bchAmount,
                              disabled: !/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !token
                            }}
                          />
                        ) : (
                          <>
                            <StyledSelectWrapper>
                              <Select
                                placeholder="Select the token to be sent"
                                onChange={value =>
                                  setSendingToken(tokens.find(t => t.tokenId === value))
                                }
                              >
                                {tokensAvaibleForAirdrop.map(t => (
                                  <Select.Option value={t.tokenId}>
                                    <StyledIconOnSelect>
                                      <Img
                                        height={16}
                                        width={16}
                                        src={`${SLP_TOKEN_ICONS_URL}/${t.tokenId}.png`}
                                        unloader={
                                          <img
                                            alt=""
                                            height={16}
                                            width={16}
                                            style={{ borderRadius: "50%" }}
                                            src={makeBlockie(t.tokenId)}
                                          />
                                        }
                                      />
                                    </StyledIconOnSelect>

                                    {t.info.name}
                                  </Select.Option>
                                ))}
                              </Select>
                            </StyledSelectWrapper>
                            {sendingToken && (
                              <FormItemWithMaxAddon
                                onMax={onMaxSendingToken}
                                inputProps={{
                                  prefix: "",
                                  name: "sendingTokenAmount",
                                  placeholder: "Amount",
                                  onChange: e => handleChange(e),
                                  required: true,
                                  value: formData.sendingTokenAmount
                                }}
                              />
                            )}
                          </>
                        )}
                        <Row
                          type="flex"
                          style={{
                            justifyContent: !token || token.isFromInput ? "center" : "inherit"
                          }}
                        >
                          <Col>
                            <StyledSwitchWrapper>
                              <Radio.Group
                                onChange={e => {
                                  setType(e.target.value === Types.BCH ? Types.BCH : Types.SLP);
                                  setSendingToken(null);
                                }}
                                defaultValue={Types.BCH}
                              >
                                <Radio.Button value={Types.BCH}>Pay using BCH</Radio.Button>
                                <Radio.Button value={Types.SLP}>Pay using SLP tokens</Radio.Button>
                              </Radio.Group>
                            </StyledSwitchWrapper>
                          </Col>
                        </Row>
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
                        disabled={!/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !token}
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
