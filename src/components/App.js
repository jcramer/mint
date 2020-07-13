import React from "react";
import "antd/dist/antd.less";
import "../index.css";
import styled from "styled-components";
import { useSwipeable } from "react-swipeable";
import { Layout, Menu, Radio, Tabs, Icon } from "antd";
import Portfolio from "./Portfolio/Portfolio";
import Icons from "./Icons/Icons";
import Create from "./Create/Create";
import Dividends from "./Dividends/Dividends";
import Configure from "./Configure/Configure";
import Audit from "./Audit/Audit";
import NotFound from "./NotFound";
import "./App.css";
import { WalletContext } from "../utils/context";
import logo from "../assets/logo.png";
import { Route, Redirect, Link, Switch, useLocation, useHistory } from "react-router-dom";
import { QRCode } from "./Common/QRCode";
import DividendHistory from "./DividendHistory/DividendHistory";

const { Header, Content, Sider, Footer } = Layout;
const { TabPane } = Tabs;

const StyledTabsMenu = styled.div`
  .ant-layout-footer {
    position: fixed;
    bottom: 0;
    width: 100%;
    padding: 0;
  }
  .ant-tabs-bar.ant-tabs-bottom-bar {
    margin-top: 0;
    border-top: 1px solid #ddd;
  }

  .ant-tabs-tab {
    span {
      font-size: 10px;
      display: grid;
      font-weight: bold;
    }
    .anticon {
      color: rgb(148, 148, 148);
      font-size: 24px;
      margin-left: 8px;
      margin-bottom: 3px;
    }
  }

  .ant-tabs-tab:hover {
    color: #4ab290 !important;
    .anticon {
      color: #4ab290;
    }
  }

  .ant-tabs-tab-active.ant-tabs-tab {
    color: #4ab290;
    .anticon {
      color: #4ab290;
    }
  }

  .ant-tabs-tab-active.ant-tabs-tab {
    color: #4ab290;
    .anticon {
      color: #4ab290;
    }
  }
  .ant-tabs-tab-active:active {
    color: #4ab290 !important;
  }
  .ant-tabs-ink-bar {
    display: none !important;
  }

  .ant-tabs-nav {
    margin: -3.5px 0 0 0;
  }
`;

const App = () => {
  const [collapsed, setCollapsed] = React.useState(window.innerWidth < 768);
  const [mobile, setMobile] = React.useState(false);
  const [address, setAddress] = React.useState("slpAddress");
  const [pixelRatio, setPixelRatio] = React.useState(1);

  const ContextValue = React.useContext(WalletContext);
  const { wallet } = ContextValue;
  const radio = React.useRef(null);
  const location = useLocation();
  const history = useHistory();
  const selectedKey = location && location.pathname ? location.pathname.substr(1) : "";

  const handleChange = e => {
    window.scrollTo(0, 0);
    setTimeout(() => {
      if (mobile) {
        setCollapsed(true);
        document.body.style.overflow = "";
      }
    }, 100);
  };

  const handleChangeAddress = e => {
    setAddress(address === "cashAddress" ? "slpAddress" : "cashAddress");
  };

  const handleResize = () => {
    setMobile(window.innerWidth < 768);
    setPixelRatio(window.devicePixelRatio);
  };

  const handleClickTrigger = e => (document.body.style.overflow = "hidden");

  React.useEffect(() => {
    if (mobile && pixelRatio === 1) {
      const triggerElement = document.getElementsByTagName("aside")[0].children[1];

      triggerElement.addEventListener("click", handleClickTrigger);

      return () => triggerElement.removeEventListener("click", handleClickTrigger);
    }

    // eslint-disable-next-line
  }, [mobile]);

  React.useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSwipe = useSwipeable({
    trackMouse: mobile,
    onSwipedRight: () => {
      if (mobile) {
        setCollapsed(false);
        document.body.style.overflow = "hidden";
      }
    },
    onSwipedLeft: () => {
      if (mobile) {
        setCollapsed(true);
        document.body.style.overflow = "";
      }
    }
  });

  return (
    <div className="App">
      <Layout style={{ minHeight: "100vh" }}>
        <div
          {...handleSwipe}
          style={
            mobile
              ? {
                  zIndex: "1000",
                  position: "absolute",
                  height: document.body.scrollHeight,
                  float: "left",
                  width: collapsed ? "40px" : "100vw",
                  background: collapsed ? null : "rgba(0, 0, 0, 0.2)"
                }
              : {
                  zIndex: "1000",
                  position: "relative",
                  float: "left",
                  width: "256px"
                }
          }
        >
          <Sider
            breakpoint="md"
            collapsedWidth="0"
            collapsed={collapsed}
            onCollapse={() => setCollapsed(!collapsed)}
            width="256"
            style={
              mobile
                ? {
                    zIndex: "100",
                    position: "fixed",
                    top: 0,
                    bottom: 0,
                    overflowY: `${collapsed ? "" : "scroll"}`,
                    overflowX: `${collapsed ? "" : "hidden"}`
                  }
                : { height: "100%" }
            }
          >
            <div className="logo">
              <img src={logo} alt="Bitcoin.com Mint" />
            </div>
            <div
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                width: "100%",
                height: "1px",
                marginBottom: "26px",
                marginTop: "19px"
              }}
            />
            <Menu
              theme="dark"
              onClick={e => handleChange(e)}
              selectedKeys={[selectedKey]}
              style={{ textAlign: "left" }}
            >
              <Menu.ItemGroup style={{ marginTop: "0px" }} key="menu" title="MENU">
                <Menu.Item key="portfolio">
                  <Link to="/portfolio">Portfolio</Link>
                </Menu.Item>
                {wallet && (
                  <Menu.Item key="create">
                    <Link to="/create">Create</Link>
                  </Menu.Item>
                )}
                <Menu.Item key="icons">
                  <Link to="/icons">Icons</Link>
                </Menu.Item>
                {wallet && (
                  <Menu.SubMenu key="dividends" title={<span>Dividends</span>}>
                    <Menu.Item key="pay-dividends">
                      <Link to="/pay-dividends">Pay Dividends</Link>
                    </Menu.Item>
                    <Menu.Item key="dividends-history">
                      <Link to="/dividends-history">Dividends History</Link>
                    </Menu.Item>
                  </Menu.SubMenu>
                )}
                <Menu.Item key="configure">
                  <Link to="/configure">Configure</Link>
                </Menu.Item>
                <Menu.Item key="audit">
                  <Link to="/audit">Audit</Link>
                </Menu.Item>
                <Menu.SubMenu key="links" title={<span>Links</span>}>
                  <Menu.Item key="link-trade-locally">
                    {" "}
                    <a href="https://send.bitcoin.com" target="_blank" rel="noopener noreferrer">
                      Send BCH by Email
                    </a>
                  </Menu.Item>
                  <Menu.Item key="link-faucet">
                    <a href="https://free.bitcoin.com/" target="_blank" rel="noopener noreferrer">
                      Faucet (Free BCH)
                    </a>
                  </Menu.Item>
                  <Menu.Item key="link-exchange">
                    <a
                      href="https://exchange.bitcoin.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Exchange
                    </a>
                  </Menu.Item>
                  <Menu.Item key="link-games">
                    {" "}
                    <a
                      href="https://cashgames.bitcoin.com/home"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Games
                    </a>
                  </Menu.Item>
                  <Menu.Item key="link-trade-locally">
                    {" "}
                    <a href="https://local.bitcoin.com" target="_blank" rel="noopener noreferrer">
                      Trade Locally
                    </a>
                  </Menu.Item>
                </Menu.SubMenu>
              </Menu.ItemGroup>

              {wallet ? (
                <Menu.ItemGroup key="menu-receive" title="RECEIVE">
                  <div
                    style={{
                      marginLeft: "20px",
                      paddingTop: "10px"
                    }}
                  >
                    <div>
                      <QRCode
                        id="borderedQRCode"
                        pixelRatio={pixelRatio}
                        address={
                          address === "slpAddress"
                            ? wallet.Path245.slpAddress
                            : wallet.Path145.cashAddress
                        }
                      />
                    </div>

                    <Radio.Group
                      defaultValue="slpAddress"
                      value={address}
                      size="small"
                      buttonStyle="solid"
                      ref={radio}
                    >
                      <Radio.Button
                        style={{
                          borderRadius: "19.5px",
                          height: "40px",
                          width: "103px"
                        }}
                        value="slpAddress"
                        onClick={e => handleChangeAddress(e)}
                      >
                        SLP Tokens
                      </Radio.Button>
                      <Radio.Button
                        style={{
                          borderRadius: "19.5px",
                          height: "40px",
                          width: "103px"
                        }}
                        value="cashAddress"
                        onClick={e => handleChangeAddress(e)}
                      >
                        Bitcoin Cash
                      </Radio.Button>
                    </Radio.Group>
                  </div>
                </Menu.ItemGroup>
              ) : null}
            </Menu>
          </Sider>
        </div>
        <Layout style={{ backgroundColor: "#FBFBFD" }}>
          <Header
            style={{
              background: "#FBFBFD",
              fontSize: "24px",
              color: "#fff"
            }}
          >
            <div
              style={{
                display: "inline",
                paddingRight: "4px",
                paddingTop: "32px"
              }}
            ></div>
          </Header>
          <Content style={{ margin: "0 16px 48px 16px", backgroundColor: "#FBFBFD" }}>
            <div
              style={{
                padding: 24,
                minHeight: 360
              }}
            >
              <Switch>
                <Route path="/portfolio">
                  <Portfolio />
                </Route>
                <Route path="/create">
                  <Create />
                </Route>
                <Route path="/icons">
                  <Icons />
                </Route>
                <Route path="/configure">
                  <Configure />
                </Route>
                <Route path="/audit">
                  <Audit />
                </Route>
                <Route path="/pay-dividends">
                  <Dividends />
                </Route>
                <Route path="/dividends-history">
                  <DividendHistory />
                </Route>
                <Redirect exact from="/" to="/portfolio" />
                <Route component={NotFound} />
              </Switch>
            </div>
          </Content>
          {mobile && (
            <StyledTabsMenu>
              <Footer>
                <Tabs
                  activeKey={selectedKey}
                  tabBarStyle={{ height: "55px" }}
                  onChange={key => handleChange({ key })}
                  tabBarGutter={"16vw"}
                  tabPosition="bottom"
                >
                  <TabPane
                    tab={
                      <span onClick={() => history.push("/portfolio")}>
                        <Icon type="folder-open" theme="filled" />
                        Portfolio
                      </span>
                    }
                    key="portfolio"
                  />
                  <TabPane
                    tab={
                      <span onClick={() => history.push("/create")}>
                        <Icon type="plus-square" theme="filled" />
                        Create
                      </span>
                    }
                    key="create"
                    disabled={!wallet}
                  />
                  <TabPane
                    tab={
                      <span onClick={() => history.push("/pay-dividends")}>
                        <Icon type="dollar-circle" theme="filled" />
                        Dividends
                      </span>
                    }
                    key="pay-dividends"
                    disabled={!wallet}
                  />
                </Tabs>
              </Footer>
            </StyledTabsMenu>
          )}
        </Layout>
      </Layout>
    </div>
  );
};

export default App;
