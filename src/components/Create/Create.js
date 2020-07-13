import React from "react";
import { withRouter, useHistory } from "react-router-dom";
import { WalletContext } from "../../utils/context";
import {
  Input,
  Button,
  notification,
  Spin,
  Icon,
  Row,
  Col,
  Card,
  Form,
  Collapse,
  Upload,
  Tooltip,
  Alert,
  Checkbox,
  Popconfirm,
  Slider,
  Switch
} from "antd";
import styled from "styled-components";
import Cropper from "react-easy-crop";
import Paragraph from "antd/lib/typography/Paragraph";
import createToken from "../../utils/broadcastTransaction";
import StyledCreate from "../Common/StyledPage";
import { EnhancedModal } from "../Portfolio/EnhancedModal";
import { QRCode } from "../Common/QRCode";
import getCroppedImg from "../../utils/cropImage";
import getRoundImg from "../../utils/roundImage";
import getResizedImage from "../../utils/resizeImage";

import * as CryptoJS from "crypto-js";

const { Dragger } = Upload;

const StyledSwitch = styled.div`
  .ant-switch-checked {
    background-color: #f34745 !important;
  }
`;

const StyledCard = styled.div`
  .ant-card-body {
    @media (max-width: 425px) {
      padding: 8px;
    }
  }
  .ant-upload-list-item-info {
    display: none;
  }
  .ant-checkbox-inner {
    border: 1px solid #20242d !important;
  }
  .ant-checkbox-wrapper {
    margin-left: 5px;
  }
`;

const StyledAlert = styled.div`
  margin-bottom: 8px;

  .ant-alert.ant-alert-info.ant-alert-no-icon.ant-alert-closable {
    background: #fff;
  }
  .ant-alert-message {
    font-size: 12px;

    .anticon {
      font-size: 14px;
    }
  }
  .ant-alert-close-icon {
    margin-right: -14px;
  }
`;

const StyledMoreOptionsCollapse = styled.div`
  .ant-collapse-content-box {
    padding: 4px !important;
  }
  .ant-collapse-content.ant-collapse-content-active {
    border: none !important;
  }
`;

const StyledHashCollapse = styled.div`
  .ant-collapse .ant-collapse-header {
    color: #c5c5c7 !important;
  }
  .ant-collapse-content.ant-collapse-content-active {
    padding: 0;
    background: #fff !important;

    .ant-collapse-content-box {
      background: #fff !important;
    }
  }

  .ant-collapse.ant-collapse-borderless.ant-collapse-icon-position-left {
    border: 1px solid #eaedf3;
    border-radius: 8px;
  }
  .ant-collapse-header {
    padding: 8px 12px 8px 12px !important;
    background: #fff;
    border-radius: 8px !important;
    font-weight: bold;
  }
  .ant-collapse-item.ant-collapse-no-arrow {
    border-bottom: none;
  }
  .ant-collapse-item.ant-collapse-item-active.ant-collapse-no-arrow {
    border-bottom: 1px solid #eaedf3;
  }
`;

const Create = () => {
  const ContextValue = React.useContext(WalletContext);
  const { wallet, balances, loading: loadingContext } = ContextValue;
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState({
    dirty: true,
    tokenName: "",
    tokenSymbol: "",
    documentHash: "",
    decimals: "",
    documentUri: "",
    amount: "",
    email: "",
    fixedSupply: false
  });
  const [hash, setHash] = React.useState("");
  const [fileList, setFileList] = React.useState();
  const [file, setFile] = React.useState();
  const [fileName, setFileName] = React.useState("");
  const [tokenIconFileList, setTokenIconFileList] = React.useState();
  const [rawImageUrl, setRawImageUrl] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [showCropModal, setShowCropModal] = React.useState(false);
  const [roundSelection, setRoundSelection] = React.useState(true);

  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [rotation, setRotation] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState(null);

  const onCropComplete = React.useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = React.useCallback(async () => {
    setLoading(true);

    try {
      const croppedResult = await getCroppedImg(rawImageUrl, croppedAreaPixels, rotation, fileName);

      if (roundSelection) {
        const roundResult = await getRoundImg(croppedResult.url, fileName);

        await getResizedImage(
          roundResult.url,
          resizedResult => {
            setData(prev => ({ ...prev, tokenIcon: resizedResult.file }));
            setImageUrl(resizedResult.url);
          },
          fileName
        );
      } else {
        setData(prev => ({ ...prev, tokenIcon: croppedResult.file }));
        setImageUrl(croppedResult.url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [croppedAreaPixels, fileName, rawImageUrl, rotation, roundSelection]);

  const onClose = React.useCallback(() => {
    setShowCropModal(false);
  }, []);

  const history = useHistory();

  const transformFile = file => {
    clear();
    return new Promise((resolve, reject) => {
      const SHA256 = CryptoJS.algo.SHA256.create();

      loadingHash(
        file,
        data => {
          const wordBuffer = CryptoJS.lib.WordArray.create(data);
          SHA256.update(wordBuffer);
        },
        () => {
          const encrypted = SHA256.finalize().toString();
          setHash(encrypted);
          setLoading(false);
          reject();
        }
      );
    });
  };

  const getFileSize = size => size / (1024 * 1024);

  const beforeUpload = file => {
    try {
      if (getFileSize(file.size) > 25) {
        throw new Error("File must be smaller than 25MB!");
      } else {
        setFile(file);
        setHash("");
        setLoading(true);
      }
    } catch (e) {
      console.error("error", e);
      notification.error({
        message: "Error",
        description: e.message || e.error || JSON.stringify(e),
        duration: 2
      });
      setFileList(undefined);
      setFile(undefined);
      setHash("");
      return false;
    }
  };

  const handleTokenIconImage = (imgFile, callback) =>
    new Promise((resolve, reject) => {
      setLoading(true);
      try {
        const reader = new FileReader();

        const width = 128;
        const height = 128;
        reader.readAsDataURL(imgFile);

        reader.addEventListener("load", () => setRawImageUrl(reader.result));

        reader.onload = event => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const elem = document.createElement("canvas");
            //console.log(`Canvas created`);
            elem.width = width;
            elem.height = height;
            const ctx = elem.getContext("2d");
            // img.width and img.height will contain the original dimensions
            ctx.drawImage(img, 0, 0, width, height);
            if (!HTMLCanvasElement.prototype.toBlob) {
              Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
                value: function(callback, type, quality) {
                  var dataURL = this.toDataURL(type, quality).split(",")[1];
                  setTimeout(function() {
                    var binStr = atob(dataURL),
                      len = binStr.length,
                      arr = new Uint8Array(len);
                    for (var i = 0; i < len; i++) {
                      arr[i] = binStr.charCodeAt(i);
                    }
                    callback(new Blob([arr], { type: type || "image/png" }));
                  });
                }
              });
            }

            ctx.canvas.toBlob(
              blob => {
                console.log(imgFile.name);

                let fileNameParts = imgFile.name.split(".");
                fileNameParts.pop();
                let fileNamePng = fileNameParts.join(".") + ".png";

                const file = new File([blob], fileNamePng, {
                  type: "image/png"
                });
                setFileName(fileNamePng);
                const resultReader = new FileReader();

                resultReader.readAsDataURL(file);
                setData(prev => ({ ...prev, tokenIcon: file }), console.log(file));
                resultReader.addEventListener("load", () => callback(resultReader.result));
                setLoading(false);
                setShowCropModal(true);
                resolve();
              },
              "image/png",
              1
            );
          };
        };
      } catch (err) {
        console.log(`Error in handleTokenIconImage()`);
        console.log(err);
        reject(err);
      }
    });

  const transformTokenIconFile = file => {
    return new Promise((resolve, reject) => {
      reject();
      // setLoading(false);
    });
  };

  const beforeTokenIconUpload = file => {
    try {
      if (file.type.split("/")[0] !== "image") {
        throw new Error("You can only upload image files!");
      } else {
        setLoading(true);
        handleTokenIconImage(file, imageUrl => setImageUrl(imageUrl));
      }
    } catch (e) {
      console.error("error", e);
      notification.error({
        message: "Error",
        description: e.message || e.error || JSON.stringify(e),
        duration: 0
      });
      setTokenIconFileList(undefined);
      setData(prev => ({ ...prev, tokenIcon: undefined }));
      setImageUrl("");
      return false;
    }
  };

  const handleChangeTokenIconUpload = info => {
    let list = [...info.fileList];

    if (info.file.type.split("/")[0] !== "image") {
      setTokenIconFileList(undefined);
      setImageUrl("");
    } else {
      setTokenIconFileList(list.slice(-1));
    }
  };

  const handleChangeUpload = info => {
    let list = [...info.fileList];
    if (getFileSize(info.file.size) > 25) {
      setFileList(undefined);
    } else {
      setFileList(list.slice(-1));
    }
  };
  const loadingHash = (file, callbackProgress, callbackFinal) => {
    const chunkSize = 1024 * 1024;
    let offset = 0;
    const size = 1024 * 1024;
    let partial;
    let index = 0;

    if (file.size === 0) {
      callbackFinal();
    }

    while (offset < file.size) {
      partial = file.slice(offset, offset + size);
      const reader = new FileReader();
      reader.size = chunkSize;
      reader.offset = offset;
      reader.index = index;
      reader.onload = evt => callbackRead(reader, file, evt, callbackProgress, callbackFinal);

      reader.readAsArrayBuffer(partial);
      offset += chunkSize;
      index += 1;
    }
  };

  let lastOffset = 0;

  const clear = () => (lastOffset = 0);

  const callbackRead = (reader, file, evt, callbackProgress, callbackFinal) => {
    if (lastOffset === reader.offset) {
      lastOffset = reader.offset + reader.size;
      callbackProgress(evt.target.result);
      if (reader.offset + reader.size >= file.size) {
        lastOffset = 0;
        callbackFinal();
      }
    } else {
      setTimeout(() => callbackRead(reader, file, evt, callbackProgress, callbackFinal), 10);
    }
  };

  const isInvalidForm = data =>
    !data.tokenName ||
    !data.tokenSymbol ||
    !data.amount ||
    Number(data.amount) <= 0 ||
    (data.decimals !== "" && data.decimals < 0) ||
    (data.decimals !== "" && data.decimals > 9) ||
    (data.decimals !== "" && data.decimals % 1 !== 0) ||
    data.decimals === "";

  async function handleCreateToken() {
    setData({
      ...data,
      dirty: false
    });

    if (isInvalidForm(data)) {
      return;
    }

    setLoading(true);
    const { tokenName, tokenSymbol, documentUri, amount, decimals, fixedSupply } = data;

    try {
      const docUri = documentUri || "mint.bitcoin.com";
      const link = await createToken(wallet, {
        name: tokenName,
        symbol: tokenSymbol,
        documentHash: hash,
        decimals,
        docUri,
        initialTokenQty: amount,
        fixedSupply
      });

      if (data.tokenIcon) {
        // Convert to FormData object for server parsing
        let formData = new FormData();
        for (let key in data) {
          formData.append(key, data[key]);
        }
        formData.append("tokenId", link.substr(link.length - 64));
        const apiUrl = "https://mint-icons.btctest.net/new";
        //const apiUrl = "http://localhost:3002/new";

        try {
          const apiTest = await fetch(apiUrl, {
            method: "POST",
            //Note: fetch automatically assigns correct header for multipart form based on formData obj
            headers: {
              Accept: "application/json"
            },
            body: formData
          });
          const apiTestJson = await apiTest.json();

          if (!apiTestJson.approvalRequested) {
            throw new Error("Error in uploading token icon");
          } else {
            window.localStorage.setItem(`${link.substr(link.length - 64)}`, imageUrl);
          }

          // console.log(apiTestJson);
          // Example response for successful request
          /*{"status": "ok", "approvalRequested": true} */
          // Example response for failed request
          /*{"status": "error", "approvalRequested": false} */
        } catch (err) {
          console.error(err.message);

          notification.error({
            message: "Error",
            description: (
              <a
                href={"https://github.com/kosinusbch/slp-token-icons#adding-your-icon"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Paragraph>{`Error in uploading token icon, you still can click here and follow the instructions.`}</Paragraph>
              </a>
            ),
            duration: 0
          });
          // TODO Show a popup, "Error in uploading icon. Create token anyway?"
          // Buttons: Yes, No
          // If user clicks Yes, create the token with no icon
          // If user clicks No, exit the function and go back to the form
        }
      }
      notification.success({
        message: "Success",
        description: (
          <a href={link} target="_blank" rel="noopener noreferrer">
            <Paragraph>
              Create token transaction successful. Click or tap here for more details
            </Paragraph>
          </a>
        ),
        duration: 2
      });

      history.push("/portfolio");
    } catch (e) {
      let message;
      if (e.message) {
        switch (e.message) {
          case "Transaction has no inputs":
            message = "Insufficient balance";
            break;
          case "Document hash must be provided as a 64 character hex string":
            message = e.message;
            break;
          case "Transaction input BCH amount is too low.  Add more BCH inputs to fund this transaction.":
            message = "Not enough BCH. Deposit some funds to use this feature.";
            break;
          default:
            message = "Transaction Failed. Try again later";
            break;
        }
      } else if (/Could not communicate with full node or other external service/.test(e.error)) {
        message = "Could not communicate with API. Please try again.";
      } else {
        message = e.error || JSON.stringify(e);
      }

      notification.error({
        message: "Error",
        description: message,
        duration: 2
      });
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleChange = e => {
    const { value, name } = e.target;

    setData(p => ({ ...p, [name]: value }));
  };

  const handleCheckbox = e => {
    const { checked, name } = e.target;
    setData(p => ({ ...p, [name]: checked }));
  };

  return (
    <StyledCreate>
      <Row justify="center" type="flex">
        <Col lg={12} span={24}>
          <Spin spinning={loading || loadingContext}>
            <StyledCard>
              <Card
                title={
                  <h2>
                    <Icon type="plus-square" theme="filled" /> Create Token
                  </h2>
                }
                bordered={true}
              >
                <div>
                  {!loadingContext && !balances.totalBalance ? (
                    <>
                      <Paragraph>
                        <QRCode
                          id="borderedQRCode"
                          address={wallet && wallet.Path145.cashAddress}
                        />
                      </Paragraph>
                      <Paragraph>You currently have 0 BCH.</Paragraph>
                      <Paragraph>
                        Deposit some BCH in order to pay for the transaction that will generate the
                        token.
                      </Paragraph>
                      <Paragraph>
                        Get free BCH from the{" "}
                        <strong>
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href="https://free.bitcoin.com/"
                          >
                            Bitcoin.com Faucet
                          </a>
                        </strong>
                        !
                      </Paragraph>
                    </>
                  ) : null}
                </div>
                <Form>
                  <Form.Item
                    labelAlign="left"
                    labelCol={{ span: 3, offset: 0 }}
                    colon={false}
                    validateStatus={!data.dirty && !data.tokenSymbol ? "error" : ""}
                    help={
                      !data.dirty && !data.tokenSymbol
                        ? "Should be combination of numbers & alphabets"
                        : ""
                    }
                    required
                  >
                    <Input
                      placeholder="token symbol e.g.: PTC"
                      name="tokenSymbol"
                      onChange={e => handleChange(e)}
                      required
                    />
                  </Form.Item>
                  <Form.Item
                    labelAlign="left"
                    labelCol={{ span: 3, offset: 0 }}
                    required
                    colon={false}
                    validateStatus={!data.dirty && Number(data.tokenName) <= 0 ? "error" : ""}
                    help={
                      !data.dirty && Number(data.tokenName) <= 0
                        ? "Should be combination of numbers & alphabets"
                        : ""
                    }
                  >
                    <Input
                      placeholder="token name"
                      name="tokenName"
                      onChange={e => handleChange(e)}
                      required
                    />
                  </Form.Item>

                  <Form.Item
                    labelAlign="left"
                    labelCol={{ span: 3, offset: 0 }}
                    colon={false}
                    required
                    validateStatus={
                      (!data.dirty && data.decimals < 0) ||
                      (!data.dirty && data.decimals > 9) ||
                      (!data.dirty && data.decimals % 1 !== 0) ||
                      (!data.dirty && data.decimals === "")
                        ? "error"
                        : ""
                    }
                    help={
                      (!data.dirty && data.decimals < 0) ||
                      (!data.dirty && data.decimals > 9) ||
                      (!data.dirty && data.decimals % 1 !== 0) ||
                      (!data.dirty && data.decimals === "")
                        ? "Must be an integer between 0 and 9"
                        : ""
                    }
                  >
                    <Input
                      style={{ padding: "0px 20px" }}
                      placeholder="decimals"
                      name="decimals"
                      onChange={e => handleChange(e)}
                      required
                      type="number"
                      min="0"
                      max="9"
                      step="1"
                    />
                  </Form.Item>

                  <Form.Item
                    labelAlign="left"
                    labelCol={{ span: 3, offset: 0 }}
                    colon={false}
                    required
                    validateStatus={!data.dirty && Number(data.amount) <= 0 ? "error" : ""}
                    help={!data.dirty && Number(data.amount) <= 0 ? "Should be greater than 0" : ""}
                  >
                    <Input
                      style={{ padding: "0px 20px" }}
                      placeholder="quantity"
                      name="amount"
                      onChange={e => handleChange(e)}
                      required
                      type="number"
                    />
                  </Form.Item>

                  <Form.Item
                    style={{ textAlign: "left" }}
                    labelAlign="left"
                    labelCol={{ span: 3, offset: 0 }}
                    colon={false}
                  >
                    <Checkbox
                      name="fixedSupply"
                      checked={data.fixedSupply}
                      onChange={e => handleCheckbox(e)}
                    >
                      Fixed Supply?{" "}
                    </Checkbox>
                    <Tooltip title="If you create a fixed supply token, you will not be able to mint additional supply for this token in the future.">
                      <Icon type="info-circle" />
                    </Tooltip>
                  </Form.Item>

                  <Collapse style={{ marginBottom: "24px" }} accordion>
                    <Collapse.Panel
                      header={<>Add token icon</>}
                      key="1"
                      style={{ textAlign: "left" }}
                    >
                      <Form.Item>
                        <Dragger
                          multiple={false}
                          transformFile={transformTokenIconFile}
                          beforeUpload={beforeTokenIconUpload}
                          onChange={handleChangeTokenIconUpload}
                          onRemove={() => false}
                          fileList={tokenIconFileList}
                          name="tokenIcon"
                          style={{
                            background: "#D3D3D3",
                            borderRadius: "8px"
                          }}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt="avatar"
                              // style={{ maxHeight: "128px", maxWidth: "100%" }}
                            />
                          ) : (
                            <>
                              {" "}
                              <Icon style={{ fontSize: "24px" }} type="upload" />
                              <p>Click, or drag file to this area to upload</p>
                              <p style={{ fontSize: "12px" }}>Must be an image</p>
                            </>
                          )}
                        </Dragger>

                        {!loading && data.tokenIcon && (
                          <>
                            <Tooltip title={data.tokenIcon.name}>
                              <Paragraph
                                ellipsis
                                style={{
                                  lineHeight: "normal",
                                  textAlign: "center",
                                  cursor: "pointer"
                                }}
                                onClick={() => setShowCropModal(true)}
                              >
                                <Icon type="paper-clip" />
                                {data.tokenIcon.name}
                              </Paragraph>
                              <Paragraph
                                ellipsis
                                style={{
                                  lineHeight: "normal",
                                  textAlign: "center",
                                  marginBottom: "10px",
                                  cursor: "pointer"
                                }}
                                onClick={() => setShowCropModal(true)}
                              >
                                Click here to crop or zoom your icon
                              </Paragraph>
                            </Tooltip>{" "}
                          </>
                        )}

                        <EnhancedModal
                          style={{ marginTop: "8px", textAlign: "left" }}
                          expand={showCropModal}
                          onClick={() => null}
                          renderExpanded={() => (
                            <>
                              {" "}
                              <Cropper
                                showGrid={false}
                                zoomWithScroll={false}
                                image={rawImageUrl}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                cropShape={roundSelection ? "round" : "rect"}
                                aspect={1 / 1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                                style={{ top: "80px" }}
                              />
                              <StyledSwitch>
                                <Switch
                                  style={{ color: "#F34745" }}
                                  name="cropShape"
                                  onChange={checked => setRoundSelection(!checked)}
                                />{" "}
                                {roundSelection
                                  ? "Change to Square Crop Shape"
                                  : "Change to Round Crop Shap"}
                              </StyledSwitch>
                              {"Zoom:"}
                              <Slider
                                defaultValue={1}
                                onChange={zoom => setZoom(zoom)}
                                min={1}
                                max={10}
                                step={0.1}
                              />
                              {"Rotation:"}
                              <Slider
                                defaultValue={0}
                                onChange={rotation => setRotation(rotation)}
                                min={0}
                                max={360}
                                step={1}
                              />
                              <Button onClick={() => showCroppedImage() && onClose()}>
                                Save changes
                              </Button>
                            </>
                          )}
                          onClose={onClose}
                        />
                        {/* Upload token icon
                        <Input
                          type="file"
                          placeholder="Token Icon"
                          name="tokenIcon"
                          onChange={e => handleChangeFile(e)}
                        /> */}
                      </Form.Item>

                      <Form.Item
                        labelAlign="left"
                        labelCol={{ span: 3, offset: 0 }}
                        colon={false}
                        validateStatus={
                          !data.dirty &&
                          data.email &&
                          !/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                            String(data.email).toLowerCase()
                          )
                            ? "error"
                            : ""
                        }
                        help={
                          !data.dirty &&
                          data.email &&
                          !/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                            String(data.email).toLowerCase()
                          )
                            ? "Must be a valid email address (or no email at all)"
                            : ""
                        }
                      >
                        <Input
                          placeholder="your email address (optional)"
                          name="email"
                          onChange={e => handleChange(e)}
                        />
                      </Form.Item>
                      <Paragraph>
                        You can add an icon after your token is created at the Icons page
                      </Paragraph>
                    </Collapse.Panel>
                  </Collapse>

                  <StyledMoreOptionsCollapse>
                    <Collapse style={{ marginBottom: "12px" }} bordered={false}>
                      <Collapse.Panel
                        header={<> More options...</>}
                        key="0"
                        style={{ textAlign: "left" }}
                      >
                        <StyledAlert>
                          <Alert
                            message={
                              <>
                                <Icon type="info-circle" /> The document hash is a sha256 hash of
                                the whitepaper for your token. You can create a hash of any
                                document, and learn more about its use, at
                                <strong>
                                  <a
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href="https://notary.bitcoin.com"
                                  >
                                    {` notary.bitcoin.com`}
                                  </a>
                                </strong>
                                . Click on the input below to hash the file.
                              </>
                            }
                            type="info"
                            closable
                          />
                        </StyledAlert>
                        <Form.Item style={{ lineHeight: "0px" }}>
                          <StyledHashCollapse>
                            <Collapse bordered={false}>
                              <Collapse.Panel
                                showArrow={false}
                                header={<>add white paper / document hash...</>}
                                key="1"
                                style={{ textAlign: "left" }}
                              >
                                <Dragger
                                  multiple={false}
                                  transformFile={transformFile}
                                  beforeUpload={beforeUpload}
                                  onChange={handleChangeUpload}
                                  onRemove={() => false}
                                  fileList={fileList}
                                  name="documentHashUpload"
                                  style={{
                                    background: "#D3D3D3",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <Icon style={{ fontSize: "24px" }} type="upload" />
                                  <p>Click, or drag file to this area to hash.</p>
                                  <p style={{ fontSize: "12px" }}>
                                    The hash is performed client-side and the file is not uploaded.
                                  </p>
                                  <Input
                                    style={{ borderRadius: 0, align: "center" }}
                                    placeholder={"white paper/document hash"}
                                    name="documentHash"
                                    disabled
                                    value={hash}
                                  />
                                </Dragger>
                                {!loading && hash && (
                                  <>
                                    <Tooltip title={file.name}>
                                      <Paragraph
                                        small
                                        ellipsis
                                        style={{
                                          lineHeight: "normal",
                                          textAlign: "center",
                                          cursor: "pointer"
                                        }}
                                      >
                                        <Icon type="paper-clip" />
                                        {file.name}
                                      </Paragraph>
                                    </Tooltip>
                                    <p style={{ textAlign: "left", marginBottom: "-6px" }}>
                                      White paper/document hash:
                                    </p>
                                    <Paragraph
                                      style={{ marginBottom: "2px" }}
                                      small
                                      copyable={{ text: hash }}
                                      ellipsis
                                    >
                                      {hash}
                                    </Paragraph>
                                  </>
                                )}
                              </Collapse.Panel>
                            </Collapse>
                          </StyledHashCollapse>
                        </Form.Item>

                        <Form.Item>
                          <Input
                            placeholder="token website e.g.: developer.bitcoin.com"
                            name="documentUri"
                            onChange={e => handleChange(e)}
                            required
                          />
                        </Form.Item>
                      </Collapse.Panel>
                    </Collapse>
                  </StyledMoreOptionsCollapse>

                  <div style={{ paddingTop: "12px" }}>
                    <Popconfirm
                      visible={!data.tokenIcon && !isInvalidForm(data) && showConfirm}
                      title="Are you sure you want to create a token without an icon？"
                      onConfirm={() => handleCreateToken()}
                      onCancel={() => setShowConfirm(false)}
                      okText="Yes"
                      cancelText="No"
                      placement="top"
                    >
                      <Button
                        onClick={
                          data.tokenIcon || isInvalidForm(data)
                            ? () => handleCreateToken()
                            : () => setShowConfirm(true)
                        }
                      >
                        Create Token
                      </Button>
                    </Popconfirm>
                  </div>
                </Form>
              </Card>
            </StyledCard>
          </Spin>
        </Col>
      </Row>
    </StyledCreate>
  );
};

export default withRouter(Create);
