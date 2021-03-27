import withSLP from "./withSLP";

const broadcastTransaction = async (SLPInstance, wallet, { ...args }) => {
  try {
    // check supported token versions
    if (args.version) {
      switch (args.version) {
        case 0x41:
        case 0x81:
          throw new Error("NFT token types are not yet supported.");
        default:
          throw new Error(`Token type ${args.version} is not supported.`);
      }
    }

    const NETWORK = process.env.REACT_APP_NETWORK;

    const TRANSACTION_TYPE =
      ((args.additionalTokenQty || args.burnBaton) && args.tokenId && "IS_MINTING") ||
      (args.initialTokenQty && args.symbol && args.name && "IS_CREATING") ||
      (args.amount && args.tokenId && args.tokenReceiverAddress && "IS_SENDING") ||
      (args.amount && args.tokenId && "IS_BURNING");

    const { Path245, Path145 } = wallet;

    const config = args;
    config.bchChangeReceiverAddress = Path145.cashAddress;
    config.fundingWif = [Path245.fundingWif, Path145.fundingWif];
    config.fundingAddress = [Path245.fundingAddress, Path145.fundingAddress];

    let createTransaction;

    switch (TRANSACTION_TYPE) {
      case "IS_CREATING":
        config.batonReceiverAddress = config.fixedSupply === true ? null : Path245.slpAddress;
        config.decimals = config.decimals || 0;
        config.documentUri = config.docUri;
        config.tokenReceiverAddress = Path245.slpAddress;
        createTransaction = async config => SLPInstance.TokenType1.create(config);
        break;
      case "IS_MINTING":
        config.batonReceiverAddress = config.batonReceiverAddress || Path245.slpAddress;
        config.tokenReceiverAddress = Path245.slpAddress;
        createTransaction = async config => SLPInstance.TokenType1.mint(config);
        break;
      case "IS_SENDING":
        config.tokenReceiverAddress = args.tokenReceiverAddress;
        createTransaction = async config => SLPInstance.TokenType1.send(config);
        break;
      case "IS_BURNING":
        createTransaction = async config => SLPInstance.TokenType1.burn(config);
        break;
      default:
        break;
    }
    const broadcastedTransaction = await createTransaction(config);

    let link;
    if (NETWORK === `mainnet`) {
      link = `https://explorer.bitcoin.com/bch/tx/${broadcastedTransaction}`;
    } else {
      link = `https://explorer.bitcoin.com/tbch/tx/${broadcastedTransaction}`;
    }

    return link;
  } catch (err) {
    const message = err.message || err.error || JSON.stringify(err);
    console.error(`Error in createToken: `, err);
    console.log(`Error message: ${message}`);
    throw err;
  }
};

export default withSLP(broadcastTransaction);
