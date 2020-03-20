export default class SlpDividends {
  static BATCH_SIZE = 18;
  static FAN_OUT_BATCH_SIZE = 25 * SlpDividends.BATCH_SIZE;

  static Status = {
    PREPARING: "PREPARING",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    CANCELED: "CANCELED",
    CRASHED: "CRASHED",
    COMPLETED: "COMPLETED"
  };

  static Errors = {
    DOUBLE_SPENDING: "code 18",
    TOO_MANY_UNCONFIRMED_ANCESTORS: "code 64",
    NO_ELIGIBLE_RECEIVERS: "custom code 1"
  };

  static ErrorMessages = {
    [SlpDividends.Errors.NO_ELIGIBLE_RECEIVERS]: "No eligible receivers"
  };

  constructor({ sendingToken, receiverToken, quantity, fanoutWallets, receivers, opReturn }) {
    this.progress = 0;
    this.status = fanoutWallets.length
      ? SlpDividends.Status.PREPARING
      : SlpDividends.Status.RUNNING;
    this.sendingToken = sendingToken;
    this.receiverToken = receiverToken;
    this.startDate = Date.now();
    this.endDate = null;
    this.preparingTxs = [];
    this.txs = [];
    this.receiverCount = receivers.length;
    this.remainingReceivers = receivers;
    this.opReturn = opReturn;
    this.quantity = quantity;
    this.fanoutWallets = fanoutWallets;
    this.fanoutFeePrepared = false;
    this.fanoutTokensPrepared = false;
    this.fundsRecovered = false;
    this.error = "";
  }

  static getAll = () =>
    window.localStorage.getItem("slpDividends")
      ? JSON.parse(window.localStorage.getItem("slpDividends"))
      : {};

  static get = slpDividend => {
    const slpDividends = SlpDividends.getAll();
    return slpDividends[slpDividend.startDate];
  };

  static save = slpDividend => {
    try {
      const storedDividends = SlpDividends.getAll();
      window.localStorage.setItem(
        "slpDividends",
        JSON.stringify({
          ...storedDividends,
          [slpDividend.startDate]: {
            ...storedDividends[slpDividend.startDate],
            ...slpDividend
          }
        })
      );
    } catch (error) {
      console.log("Unable to save slp dividend due to: ", error.message);
    }
  };
}
