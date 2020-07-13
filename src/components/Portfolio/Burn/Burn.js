import React, { useState } from "react";
import styled from "styled-components";
import { WalletContext } from "../../../utils/context";
import broadcastTransaction from "../../../utils/broadcastTransaction";
import { Alert, Card, Icon, Form, Input, Button, Spin, notification, Switch } from "antd";
import { Row, Col } from "antd";
import Paragraph from "antd/lib/typography/Paragraph";
import { FireIcon } from "../../Common/CustomIcons";
import { FormItemWithMaxAddon } from "../EnhancedInputs";

const StyledInput = styled.div`
  .ant-form-item-control.has-error ant-input {
    border-color: #f34745 !important;
  }
`;

const StyledBurnAlert = styled.div`
  .ant-alert.ant-alert-warning.ant-alert-no-icon {
    margin-bottom: 10px;
    border: 2px solid #e4454f !important;
    border-radius: 4px;
    background-color: #fdf1f0 !important;
  }
  .anticon.anticon-warning {
    color: #f2484c !important;
  }
`;

const StyledSwitch = styled.div`
  .ant-switch-checked {
    background-color: #f34745 !important;
  }

  color: rgb(62, 63, 66);
`;

const countDecimals = value => {
  if (Math.floor(value).toString() === value) return 0;
  return value.split(".")[1].length || 0;
};

const validateAmount = (amount, tokenBalance, step, decimals) => {
  const valid =
    amount !== "" &&
    Number.parseFloat(amount) <= Number.parseFloat(tokenBalance) &&
    Number.parseFloat(amount) >= Number.parseFloat(step) &&
    (amount.includes(".") ? countDecimals(amount) <= decimals : true);

  return valid;
};

const Burn = ({ token, avatar, onClose }) => {
  const ContextValue = React.useContext(WalletContext);
  const { hasBaton, balance } = token;
  const hasBalance = balance && balance.gt(0);
  const decimals = token.info.decimals;
  const step = Math.pow(10, -1 * decimals).toFixed(decimals);
  const { wallet } = ContextValue;
  const [formData, setFormData] = useState({
    dirty: true,
    textToDelete: "",
    amount: "",
    burnBaton: false
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setFormData({
      ...formData,
      dirty: false
    });

    if (
      formData.textToDelete !== `burn ${token.info.name}` ||
      (hasBalance && !validateAmount(formData.amount, token.balance.toString(), step, decimals)) ||
      (!hasBalance && hasBaton && formData.burnBaton === false)
    ) {
      return;
    }

    setLoading(true);

    try {
      let link;
      if (hasBalance && formData.burnBaton === false) {
        link = await broadcastTransaction(wallet, {
          tokenId: token.tokenId,
          amount: Number.parseFloat(formData.amount)
        });

        notification.success({
          message: "Success",
          description: (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Paragraph>Tokens burned. Click or tap here for more details</Paragraph>
            </a>
          ),
          duration: 3
        });
      } else if (!hasBalance && hasBaton && formData.burnBaton === true) {
        link = await broadcastTransaction(wallet, {
          tokenId: token.tokenId,
          additionalTokenQty: 0,
          batonReceiverAddress: null,
          burnBaton: true
        });

        notification.success({
          message: "Success",
          description: (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Paragraph>Burn baton successful. Click or tap here for more details</Paragraph>
            </a>
          ),
          duration: 3
        });
      } else if (hasBalance && hasBaton && formData.burnBaton === true) {
        link = await broadcastTransaction(wallet, {
          tokenId: token.tokenId,
          additionalTokenQty: 0,
          batonReceiverAddress: null,
          burnBaton: true
        });

        notification.success({
          message: "Success",
          description: (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Paragraph>Burn baton successful. Click or tap here for more details</Paragraph>
            </a>
          ),
          duration: 3
        });

        link = await broadcastTransaction(wallet, {
          tokenId: token.tokenId,
          amount: Number.parseFloat(formData.amount)
        });

        notification.success({
          message: "Success",
          description: (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Paragraph>Tokens burned. Click or tap here for more details</Paragraph>
            </a>
          ),
          duration: 3
        });
      }

      onClose();
      setLoading(false);
    } catch (e) {
      let message;

      if (/Could not communicate with full node or other external service/.test(e.error)) {
        message = "Could not communicate with API. Please try again.";
      } else if (/Transaction input BCH amount is too low/.test(e.message)) {
        message = "Not enough BCH. Deposit some funds to use this feature.";
      } else {
        message = e.message || e.error || JSON.stringify(e);
      }

      notification.error({
        message: "Error",
        description: message,
        duration: 3
      });
      console.error(e);
      setLoading(false);
    }
  }

  const handleChange = e => {
    const { value, name } = e.target;

    setFormData(p => ({ ...p, [name]: value }));
  };
  const handleChangeSwitch = checked => setFormData(p => ({ ...p, burnBaton: checked }));

  return (
    <Row type="flex">
      <Col span={24}>
        <Spin spinning={loading}>
          <Card
            title={
              <h2>
                <FireIcon style={{ marginBottom: "4px" }} /> Burn
              </h2>
            }
            bordered={false}
          >
            <br />
            <Row justify="center" type="flex">
              <Col span={24}>
                <StyledBurnAlert>
                  <div
                    style={{
                      fontSize: "32px",
                      textAlign: "center",
                      marginBottom: "-21px",
                      zIndex: "2",
                      position: "relative"
                    }}
                  >
                    <Icon twoToneColor="#F34745" theme="twoTone" type="exclamation-circle" />
                  </div>
                  <Alert
                    message={
                      <span>
                        <Paragraph
                          style={{
                            fontSize: "24px",
                            fontWeight: "bold",
                            marginTop: "8px",
                            textAlign: "center",
                            marginBottom: "12px"
                          }}
                        >
                          Burning Tokens?
                        </Paragraph>
                        <ul>
                          <li>
                            <Paragraph>
                              Burning tokens is <strong>irreversible</strong>.
                            </Paragraph>
                          </li>
                          <li>
                            <Paragraph>
                              <strong>
                                You may LOSE all of your <em>{token.info.name}</em> tokens.
                              </strong>
                            </Paragraph>
                          </li>
                          {hasBaton && (
                            <li>
                              <Paragraph>
                                <strong>
                                  If the <em>"Burn Mint Baton?"</em> option is checked you will LOSE
                                  the ability to mint more <em>{token.info.name}</em> tokens
                                  permanently.
                                </strong>
                              </Paragraph>
                            </li>
                          )}
                        </ul>
                      </span>
                    }
                    type="warning"
                  />
                </StyledBurnAlert>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <Paragraph
                  style={{ textAlign: "center", fontWeight: "bold", color: "#3E3F42" }}
                >{`Type "burn ${token.info.name}" on the last input to confirm`}</Paragraph>
              </Col>
            </Row>
            <Row type="flex">
              <Col span={24}>
                <Form style={{ width: "auto" }}>
                  {hasBalance && (
                    <FormItemWithMaxAddon
                      validateStatus={
                        !formData.dirty &&
                        !validateAmount(formData.amount, token.balance.toString(), step, decimals)
                          ? "error"
                          : ""
                      }
                      help={
                        !formData.dirty &&
                        !validateAmount(formData.amount, token.balance.toString(), step, decimals)
                          ? `Must be a number greater than or equal to ${step} and less than or equal to ${token.balance.toString()} and the number of decimal places must be less than or equal to ${decimals}`
                          : ""
                      }
                      onMax={() =>
                        setFormData({
                          ...formData,
                          amount: token.balance.toString()
                        })
                      }
                      required={true}
                      inputProps={{
                        name: "amount",
                        placeholder: "Token amount",
                        onChange: e => handleChange(e),
                        required: true,
                        value: formData.amount,
                        type: "number",
                        min: step,
                        max: token.balance.toString(),
                        step: step,
                        prefix: avatar
                      }}
                    />
                  )}

                  {hasBaton && (
                    <Form.Item
                      required={!hasBalance}
                      validateStatus={
                        !formData.dirty && formData.burnBaton === false && !hasBalance
                          ? "error"
                          : ""
                      }
                      help={
                        !formData.dirty && formData.burnBaton === false && !hasBalance
                          ? `Check it if you want to burn the mint baton`
                          : ""
                      }
                    >
                      <StyledSwitch>
                        <Switch
                          style={{ color: "#F34745" }}
                          name="burnBaton"
                          onChange={e => handleChangeSwitch(e)}
                        />{" "}
                        Burn Mint Baton?
                      </StyledSwitch>
                    </Form.Item>
                  )}

                  <StyledInput>
                    <Form.Item
                      validateStatus={
                        !formData.dirty && formData.textToDelete !== `burn ${token.info.name}`
                          ? "error"
                          : ""
                      }
                      help={
                        !formData.dirty && formData.textToDelete !== `burn ${token.info.name}`
                          ? `Type "burn ${token.info.name}" to confirm.`
                          : ""
                      }
                      required
                    >
                      <Input
                        prefix={<Icon type="block" />}
                        placeholder=""
                        name="textToDelete"
                        onChange={e => handleChange(e)}
                        required
                        type="text"
                      />
                    </Form.Item>
                  </StyledInput>
                  <div style={{ paddingTop: "12px" }}>
                    <Button
                      style={{ color: "#f34745", borderColor: "#f34745" }}
                      type="danger"
                      onClick={() => submit()}
                    >
                      <FireIcon />
                      Burn
                    </Button>
                  </div>
                </Form>
              </Col>
            </Row>
          </Card>
        </Spin>
      </Col>
    </Row>
  );
};

export default Burn;
