import { notification, Row, Col, Spin, Card, Form, Icon, Button, Select } from "antd";
import React, { useState } from "react";
import { WalletContext } from "../../../utils/context";
import { PlaneIcon } from "../../Common/CustomIcons";
import { StyledButtonWrapper } from "../../Portfolio/PayDividends/PayDividends";
import Paragraph from "antd/lib/skeleton/Paragraph";
import { QRCode } from "../../Common/QRCode";
import { FormItemWithQRCodeAddon, FormItemWithMaxAddon } from "../../Portfolio/EnhancedInputs";
import { getRestUrl } from "../../../utils/withSLP";
import StyledPage from "../../Common/StyledPage";

export default ({ onClose }) => {
  const { tokens = [], wallet, balances, loading: contextLoading } = React.useContext(
    WalletContext
  );
  const [formData, setFormData] = useState({
    dirty: false,
    quantity: "",
    address: ""
  });
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState();
  const [stampToken, setStampToken] = useState();

  async function submit() {
    setFormData({
      ...formData,
      dirty: false
    });

    if (!formData.address || !formData.quantity || Number(formData.quantity) <= 0) {
      return;
    }

    setLoading(true);
    const { quantity, address } = formData;

    try {
      notification.success({
        message: "Success",
        duration: 2
      });

      onClose();
      setLoading(false);
    } catch (e) {
      let message;

      if (/don't have the minting baton/.test(e.message)) {
        message = e.message;
      } else if (/has no matching Script/.test(e.message)) {
        message = "Invalid address";
      } else if (/Transaction input BCH amount is too low/.test(e.message)) {
        message = "Not enough BCH. Deposit some funds to use this feature.";
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

    setFormData(p => ({ ...p, [name]: value }));
  };

  const onChooseToken = tokenId => {
    const t = tokens.find(t => t.tokenId === tokenId);
    setToken(t);
  };

  const onChooseStampToken = tokenId => {
    const t = tokens.find(t => t.tokenId === tokenId);
    setStampToken(t);
  };

  const onMax = () => {
    setFormData({ ...formData, quantity: (token && token.balance) || 0 });
  };

  return (
    <StyledPage>
      <Row justify="center" type="flex">
        <Col lg={10} span={24}>
          <Spin spinning={loading || contextLoading}>
            <Card
              title={
                <h2>
                  <PlaneIcon /> Post Office Send - tokens
                </h2>
              }
              bordered
            >
              <br />
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
                <Row type="flex">
                  <Col span={24}>
                    <Form style={{ width: "auto" }}>
                      <Form.Item>
                        <Select placeholder="Choose the stamp token" onChange={onChooseStampToken}>
                          {tokens.map(t => (
                            <Select.Option value={t.tokenId}>
                              {t.info.symbol} - {t.info.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item>
                        <Select placeholder="Choose the token to be sent" onChange={onChooseToken}>
                          {tokens.map(t => (
                            <Select.Option value={t.tokenId}>
                              {t.info.symbol} - {t.info.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <FormItemWithQRCodeAddon
                        validateStatus={formData.dirty && !formData.address ? "error" : ""}
                        help={
                          formData.dirty && !formData.address ? "Should be a valid slp address" : ""
                        }
                        onScan={result => setFormData({ ...formData, address: result })}
                        inputProps={{
                          placeholder: "SLP Address",
                          name: "address",
                          onChange: e => handleChange(e),
                          required: true,
                          value: formData.address
                        }}
                      />

                      <FormItemWithMaxAddon
                        validateStatus={
                          formData.dirty && Number(formData.quantity) <= 0 ? "error" : ""
                        }
                        help={
                          formData.dirty && Number(formData.quantity) <= 0
                            ? "Should be greater than 0"
                            : ""
                        }
                        onMax={onMax}
                        inputProps={{
                          prefix: <Icon type="block" />,
                          placeholder: "Amount",
                          name: "quantity",
                          onChange: e => handleChange(e),
                          required: true,
                          type: "number",
                          value: formData.quantity,
                          disabled: !stampToken
                        }}
                      />
                      <div style={{ paddingTop: "12px" }}>
                        <Button onClick={() => submit()} disabled={!stampToken}>
                          Send
                        </Button>
                      </div>
                    </Form>
                  </Col>
                </Row>
              )}
            </Card>
          </Spin>
        </Col>
      </Row>
    </StyledPage>
  );
};
