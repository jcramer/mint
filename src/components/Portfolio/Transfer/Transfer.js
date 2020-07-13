import React, { useState } from "react";
import { WalletContext } from "../../../utils/context";

import { Card, Icon, Form, Button, Spin, notification } from "antd";
import { Row, Col } from "antd";
import Paragraph from "antd/lib/typography/Paragraph";
import sendToken from "../../../utils/broadcastTransaction";
import { PlaneIcon } from "../../Common/CustomIcons";
import { FormItemWithMaxAddon, FormItemWithQRCodeAddon } from "../EnhancedInputs";
import { getRestUrl } from "../../../utils/withSLP";
import { StyledButtonWrapper } from "../PayDividends/PayDividends";
import { QRCode } from "../../Common/QRCode";

const Transfer = ({ token, onClose }) => {
  const { wallet, balances } = React.useContext(WalletContext);
  const [formData, setFormData] = useState({
    dirty: false,
    quantity: "",
    address: ""
  });
  const [loading, setLoading] = useState(false);

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
      const link = await sendToken(wallet, {
        tokenId: token.tokenId,
        amount: quantity,
        tokenReceiverAddress: address
      });

      notification.success({
        message: "Success",
        description: (
          <a href={link} target="_blank" rel="noopener noreferrer">
            <Paragraph>Transaction successful. Click or tap here for more details</Paragraph>
          </a>
        ),
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

  const onMax = () => {
    setFormData({ ...formData, quantity: token.balance || 0 });
  };

  return (
    <Row type="flex">
      <Col span={24}>
        <Spin spinning={loading}>
          <Card
            title={
              <h2>
                <PlaneIcon /> Send
              </h2>
            }
            bordered={false}
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
                        value: formData.quantity
                      }}
                    />
                    <div style={{ paddingTop: "12px" }}>
                      <Button onClick={() => submit()}>Send</Button>
                    </div>
                  </Form>
                </Col>
              </Row>
            )}
          </Card>
        </Spin>
      </Col>
    </Row>
  );
};

export default Transfer;
