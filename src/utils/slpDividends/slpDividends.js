export default class SlpDividends {
  static BATCH_SIZE = 18;

  static Status = {
    IN_PROGRESS: 0,
    PAUSED: 1,
    CANCELED: 2,
    CRASHED: 3
  };

  static ERRORS = {
    DOUBLE_SPENDING: "code 18",
    TOO_MANY_UNCONFIRMED_ANCESTORS: "code 64"
  };

  constructor({
    sendingToken,
    receiverToken,
    slpDividendQuantity,
    eligibleSlpDividendReceivers,
    slpDividendQuantities,
    opReturn
  }) {
    this.progress = 0;
    this.status = SlpDividends.Status.IN_PROGRESS;
    this.sendingToken = sendingToken;
    this.receiverToken = receiverToken;
    this.startDate = Date.now();
    this.endDate = null;
    this.txs = [];
    this.receiverCount = eligibleSlpDividendReceivers.length;
    this.remainingReceivers = eligibleSlpDividendReceivers;
    this.remainingQuantities = slpDividendQuantities;
    this.opReturn = opReturn;
    this.slpDividendQuantity = slpDividendQuantity;
    this.error = "";
  }

  static getAll = () =>
    window.localStorage.getItem("slpDividends")
      ? JSON.parse(window.localStorage.getItem("slpDividends"))
      : {};

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
