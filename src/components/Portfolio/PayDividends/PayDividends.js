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
  Switch,
  Select
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

  * {
    background-color: rgb(223, 223, 223) !important;
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
    amount: "",
    tokenId: initialToken ? initialToken.tokenId : null,
    maxAmount: 0,
    maxAmountChecked: false,
    slpAmount: ""
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
    amount: formData.amount,
    type,
    setLoading,
    advancedOptions,
    disabled: !/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !token
  });

  const validSlpDividend = sendingToken && formData.slpAmount >= 0;
  const validBchDividend =
    formData.amount > DUST && (!stats.maxAmount || formData.amount <= stats.maxAmount);
  const submitEnabled =
    /^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) &&
    ((type === Types.SLP && validSlpDividend) || (type === Types.BCH && validBchDividend)) &&
    (!advancedOptions ||
      !advancedOptions.opReturnMessage ||
      advancedOptions.opReturnMessage.length <= 60) &&
    token;

  const tokensAvaibleForAirdrop = tokens ? tokens.filter(t => t.balance > 0) : [];

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
      if (type === Types.BCH) {
        await createDividends(
          wallet,
          stats.balances,
          slpBalancesAndUtxos.nonSlpUtxos,
          advancedOptions,
          {
            value: amount,
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
            quantity: formData.slpAmount,
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
    setFormData(data => ({ ...data, dirty: true, maxAmountChecked: false, [name]: value }));
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

  const onMaxSendingToken = () => {
    setFormData({ ...formData, slpAmount: sendingToken.balance, dirty: true });
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
                                maxAmountChecked: false,
                                tokenId: null,
                                maxAmount: 0,
                                amount: ""
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
                                    stats.maxAmount > 0
                                      ? `and lower or equal to ${stats.maxAmount}`
                                      : ""
                                  }`
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
                              disabled: !/^[A-Fa-f0-9]{64}$/g.test(formData.tokenId) || !token
                            }}
                          />
                        ) : (
                          <>
                            <StyledSelectWrapper>
                              <Select
                                placeholder="Select the sending token"
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
                                  name: "slpAmount",
                                  placeholder: "Amount",
                                  onChange: e => handleChange(e),
                                  required: true,
                                  value: formData.slpAmount
                                }}
                              />
                            )}
                          </>
                        )}
                        <StyledSwitchWrapper>
                          <Switch
                            checkedChildren="Bitcoin Cash"
                            unCheckedChildren="SLP Tokens"
                            defaultChecked
                            onChange={checked => {
                              setType(checked ? Types.BCH : Types.SLP);
                            }}
                          />
                        </StyledSwitchWrapper>
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
