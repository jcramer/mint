import * as React from "react";
import { notification, Icon, Collapse, Typography } from "antd";
import { WalletContext } from "../../utils/context";
import isEmpty from "lodash/chunk";
import styled from "styled-components";

import { StyledCollapse } from "../Common/StyledCollapse";
const { Paragraph } = Typography;
const { Panel } = Collapse;

const StyledFallback = styled.div`
  .anticon.anticon-warning {
    font-size: 21px;
    color: #f2484c !important;
  }

  .ant-typography {
    text-align: left;
    color: rgb(206, 17, 38) !important;
    display: flex;
    flex-direction: row-reverse;
    max-width: 100%;
    word-break: break-word;
    .ant-typography-copy {
      margin-right: 5px;
    }

    @media (max-width: 600px) {
      font-size: 10px;
    }
  }
  .ant-collapse {
    border: 2px solid #e4454f !important;
    border-radius: 4px;
    background-color: #fdf1f0 !important;
  }
  h1 {
    font-weight: 700;
    margin-top: 10px;
  }
`;
const StyledIcon = styled.div`
  font-size: 32px;
  text-align: center;
  margin-top: -29px;
  z-index: 2;
  position: relative;
`;

const handleErrorMessage = e => {
  const obj = JSON.parse(e.message);
  return {
    shouldFallback: obj && obj.stack && obj.message && obj.fallback,
    error: isEmpty(obj.error) ? obj.stack || obj.message : obj.error
  };
};
class ErrorBoundary extends React.Component {
  static contextType = WalletContext;

  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      fallback: true,
      error: ""
    };
  }

  static getDerivedStateFromError(e) {
    const { shouldFallback, error } = handleErrorMessage(e);
    return {
      hasError: true,
      fallback: shouldFallback,
      error
    };
  }

  componentDidCatch(e) {
    console.log("this.state :", e);
    const { shouldFallback, error } = handleErrorMessage(e);
    if (!shouldFallback) {
      notification.error({
        message: "Error",
        description: "sdfsdfsdfsdf",
        duration: 0
      });
    }

    this.setState({
      hasError: true,
      fallback: shouldFallback,
      error
    });
  }

  render() {
    console.log("this.state :", this.state);
    if (this.state.hasError && this.state.fallback) {
      return (
        <StyledFallback>
          <StyledCollapse>
            <Panel
              header={
                <>
                  <StyledIcon>
                    <Icon twoToneColor="#F34745" theme="twoTone" type="exclamation-circle" />
                  </StyledIcon>
                  <h1>Something went wrong</h1>
                </>
              }
              key="1"
            >
              <Paragraph copyable={{ text: this.state.error }}>{this.state.error}</Paragraph>
            </Panel>
          </StyledCollapse>
        </StyledFallback>
      );
    } else {
      return this.props.children;
    }
  }
}

export default ErrorBoundary;
