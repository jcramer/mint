import * as React from "react";
import { notification, Icon, Collapse, Typography, Spin } from "antd";

import { isEmpty } from "lodash";
import styled from "styled-components";

import { StyledCollapse } from "../Common/StyledCollapse";
const { Paragraph } = Typography;
const { Panel } = Collapse;

const StyledFallback = styled.div`
  margin-top: 80px;
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
  console.log("e :", e);
  const obj = JSON.parse((e || {}).message || "{}");
  console.log("obj :", isEmpty(obj));

  return {
    shouldFallback: isEmpty(obj) ? true : obj && obj.stack && obj.message && obj.fallback,
    error: isEmpty(obj)
      ? e.stack || e.message || JSON.stringify(e)
      : isEmpty(obj.error)
      ? obj.stack || obj.message
      : JSON.stringify(obj.error)
  };
};
class ParentErrorBoundary extends React.Component {
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
  // updateAndNotify = () => {
  //   console.log("this.context :", this.context);
  //   if (this.context.wallet) {
  //     this.setState({
  //       ...this.state,
  //       loading: false
  //     });
  //   }
  // };

  // componentDidUpdate() {
  //   console.log("this.state.loading :", this.state.loading);
  //   console.log("this.context.loadingUpdate :", this.context.loadingUpdate);
  //   setTimeout(() => {
  //     if (
  //       this.state.error &&
  //       this.state.hasError &&
  //       this.state.fallback &&
  //       this.context.error &&
  //       !this.context.loadingUpdate
  //     ) {
  //       this.setState({
  //         loading: false
  //       });
  //     }
  //   }, 1000);
  // }
  componentDidCatch(e) {
    console.log("this.state :", e);
    const { shouldFallback, error } = handleErrorMessage(e);
    if (!shouldFallback) {
      notification.error({
        message: "Error",
        description: error,
        duration: 3
      });
    }
    this.setState({
      hasError: true,
      fallback: shouldFallback,
      error
    });
  }

  render() {
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

export default ParentErrorBoundary;
