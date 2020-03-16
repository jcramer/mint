import * as React from "react";
import Paragraph from "antd/lib/typography/Paragraph";
import useAsyncError from "../../../utils/globalError/useAsyncError";

const TokenHistory = ({ history, wallet }) => {
  console.log("history :", history);
  const [arr, setArr] = React.useState();
  const throwError = useAsyncError({ shouldFallback: true });

  React.useEffect(() => {
    const fetch = async () => {
      try {
        const resp = await history();
        setArr(resp);
      } catch (err) {
        console.log("err :", err.stack);
        throwError(err);
      }
    };
    fetch();
  }, []);

  return arr ? (
    <>
      <p>Transaction History (max 30)</p>
      {arr.map(el => (
        <div
          key={`history-${el.txid}`}
          style={{
            background:
              el.balance > 0
                ? el.detail.transactionType === "BURN"
                  ? "#FDF1F0"
                  : "#D4EFFC"
                : el.detail.transactionType.includes("BURN")
                ? "#FDF1F0"
                : "#ffd59a",
            color: "black",
            borderRadius: "12px",
            marginBottom: "18px",
            padding: "8px",
            boxShadow: "6px 6px #888888",
            width: "97%"
          }}
        >
          {el.detail.transactionType !== "BURN_ALL" ? (
            <a
              href={`https://explorer.bitcoin.com/bch/tx/${el.txid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <p>
                {el.balance > 0
                  ? el.detail.transactionType === "GENESIS"
                    ? "Genesis"
                    : el.detail.transactionType === "MINT"
                    ? "Mint"
                    : el.detail.transactionType === "BURN"
                    ? "Burn"
                    : "Received"
                  : el.detail.transactionType === "BURN_BATON"
                  ? "Burn Baton"
                  : "Sent"}
              </p>
              <p>{el.date.toLocaleString()}</p>

              {el.detail.transactionType === "BURN" &&
                (el.detail.burnAmount ? (
                  <p>{`${el.detail.burnAmount} ${el.detail.symbol} burned`}</p>
                ) : (
                  <p>Burn amount could not be found for this transaction</p>
                ))}

              {el.detail.transactionType !== "BURN_BATON" && (
                <p>{`${el.balance > 0 && el.detail.transactionType !== "BURN" ? "+" : ""}${
                  el.balance
                } ${el.detail.symbol} ${el.detail.transactionType === "BURN" ? "left" : ""}`}</p>
              )}

              <Paragraph
                small
                ellipsis
                style={{
                  whiteSpace: "nowrap",
                  color: "black",
                  maxWidth: "90%"
                }}
              >
                {el.txid}
              </Paragraph>
              <p>{`Confirmations: ${el.confirmations}`}</p>
            </a>
          ) : (
            <p>Burn All</p>
          )}
        </div>
      ))}
      <a
        href={`https://explorer.bitcoin.com/bch/address/${wallet.Path245.slpAddress}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <p>Full History</p>
      </a>
    </>
  ) : null;
};

export default TokenHistory;
