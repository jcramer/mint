import * as React from "react";
import { Form, Input, Icon, Button, message } from "antd";
import styled from "styled-components";
import bchLogo from "../../assets/bch-logo-2.png";
import { ScanQRCode } from "./ScanQRCode";
import withSLP from "../../utils/withSLP";

export const InputAddonText = styled.span`
  width: 100%;
  height: 100%;
  display: block;

  ${props =>
    props.disabled
      ? `
      cursor: not-allowed;
      `
      : `cursor: pointer;`}
`;

export const FormItemWithMaxAddon = ({ onMax, inputProps, ...otherProps }) => {
  return (
    <Form.Item {...otherProps}>
      <Input
        prefix={<img src={bchLogo} alt="" width={16} height={16} />}
        addonAfter={
          <InputAddonText
            disabled={!!(inputProps || {}).disabled}
            onClick={!(inputProps || {}).disabled && onMax}
          >
            max
          </InputAddonText>
        }
        {...inputProps}
      />
    </Form.Item>
  );
};

export const FormItemWithQRCodeAddon = ({ onScan, inputProps, ...otherProps }) => {
  return (
    <Form.Item {...otherProps}>
      <Input
        prefix={<Icon type="wallet" />}
        addonAfter={<ScanQRCode delay={300} onScan={onScan} />}
        {...inputProps}
      />
    </Form.Item>
  );
};

export const FormItemWithTokenSearchAddon = ({
  onResult = () => null,
  onClear = () => null,
  onLoading = () => null,
  inputProps,
  ...otherProps
}) => {
  const [dirty, setDirty] = React.useState(false);
  const [tokenId, setTokenId] = React.useState("");
  const [tokenNotFound, setTokenNotFound] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [token, setToken] = React.useState();
  const [lastSearchedTokenId, setLastSearchedTokenId] = React.useState("");
  const tokenIdRef = React.useRef(null);

  const onSearch = withSLP(async (SLP, tokenId) => {
    if (/^[A-Fa-f0-9]{64}$/g.test(tokenId)) {
      setLoading(true);
      onLoading(true);
      try {
        const token = await SLP.Utils.list(tokenId);
        if (token.id !== "not found") {
          setToken(token);
          setTokenNotFound(false);
          onResult(token);
        } else {
          setToken(undefined);
          setTokenNotFound(true);
          setLastSearchedTokenId(tokenId);
        }
      } catch (error) {
        message.error("Unable to find the token due to network errors. Please, try again later.");
      }
      setLoading(false);
      onLoading(false);
    } else {
      setLastSearchedTokenId(tokenId ? tokenId : " ");
    }
  });

  const handleOnClear = e => {
    setTokenNotFound(false);
    setToken(undefined);

    tokenIdRef.current.handleReset(e);
    setLastSearchedTokenId("");
    onClear();
  };

  return (
    <Form.Item
      validateStatus={
        dirty &&
        (!token && lastSearchedTokenId) &&
        (!/^[A-Fa-f0-9]{64}$/g.test(tokenId) ||
          (tokenNotFound &&
            lastSearchedTokenId === tokenId &&
            /^[A-Fa-f0-9]{64}$/g.test(tokenId))) &&
        !loading
          ? "error"
          : ""
      }
      help={
        dirty &&
        (!token && lastSearchedTokenId) &&
        (!/^[A-Fa-f0-9]{64}$/g.test(tokenId) ||
          (tokenNotFound &&
            lastSearchedTokenId === tokenId &&
            /^[A-Fa-f0-9]{64}$/g.test(tokenId))) &&
        !loading
          ? tokenNotFound && lastSearchedTokenId === tokenId && /^[A-Fa-f0-9]{64}$/g.test(tokenId)
            ? "Token not found. Try a different Token ID."
            : "Invalid Token ID"
          : /^[A-Fa-f0-9]{64}$/g.test(tokenId) && !token
          ? "Click on search"
          : ""
      }
      required
      {...otherProps}
    >
      <Input
        prefix={<Icon type="block" />}
        placeholder="Token ID"
        name="tokenId"
        onChange={e => {
          setTokenId(e.target.value);
          setDirty(true);
        }}
        disabled={!tokenNotFound && token}
        ref={tokenIdRef}
        required
        autoComplete="off"
        type="text"
        addonAfter={
          !tokenNotFound && token ? (
            <Button ghost type="link" icon="edit" onClick={handleOnClear} />
          ) : (
            <Button ghost type="link" icon="search" onClick={() => onSearch(tokenId)} />
          )
        }
        {...inputProps}
      />
    </Form.Item>
  );
};

export const AddressValidators = withSLP(SLP => ({
  safelyDetectAddressFormat: value => {
    try {
      return SLP.Address.detectAddressFormat(value);
    } catch (error) {
      return null;
    }
  },
  isSLPAddress: value => AddressValidators.safelyDetectAddressFormat(value) === "slpaddr",
  isBCHAddress: value => AddressValidators.safelyDetectAddressFormat(value) === "cashaddr",
  isLegacyAddress: value => AddressValidators.safelyDetectAddressFormat(value) === "legacy"
}))();
