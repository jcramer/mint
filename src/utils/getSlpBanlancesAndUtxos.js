import chunk from "lodash/chunk";
import BigNumber from "bignumber.js";
import withSLP from "./withSLP";

const getSLPTxType = scriptASMArray => {
  if (scriptASMArray[0] !== "OP_RETURN") {
    throw new Error("Not an OP_RETURN");
  }

  if (scriptASMArray[1] !== "534c5000") {
    throw new Error("Not a SLP OP_RETURN");
  }

  // any token version listed here will display in the portfolio
  if (
    scriptASMArray[2] !== "OP_1" && // 0x01 = Fungible token
    scriptASMArray[2] !== "OP_1NEGATE" && // 0x81 = NFT Group
    scriptASMArray[2] !== "41" // 0x41 = NFT Token
  ) {
    // NOTE: bitcoincashlib-js converts hex 01 to OP_1 due to BIP62.3 enforcement
    throw new Error("Unknown token type");
  }

  var type = Buffer.from(scriptASMArray[3], "hex")
    .toString("ascii")
    .toLowerCase();

  // this converts the ASM representation of the version field to a number
  var version = scriptASMArray[2] === "OP_1" ? 0x01 : scriptASMArray[2] === "41" ? 0x41 : 0x81;

  return { txType: type, version };
};

const decodeTxOut = withSLP((SLP, txOut) => {
  const out = {
    tokenId: "",
    balance: new BigNumber(0, 16),
    hasBaton: false,
    version: 0
  };

  const vout = parseInt(txOut.vout, 10);

  const script = SLP.Script.toASM(Buffer.from(txOut.tx.vout[0].scriptPubKey.hex, "hex")).split(" ");
  const type = getSLPTxType(script);
  out.version = type.version;

  if (type.txType === "genesis") {
    if (typeof script[9] === "string" && script[9].startsWith("OP_")) {
      script[9] = parseInt(script[9].slice(3), 10).toString(16);
    }
    if ((script[9] === "OP_2" && vout === 2) || parseInt(script[9], 16) === vout) {
      out.tokenId = txOut.txid;
      out.hasBaton = true;
      return out;
    }
    if (vout !== 1) {
      throw new Error("Not a SLP txout");
    }
    out.tokenId = txOut.txid;
    out.balance = new BigNumber(script[10], 16);
  } else if (type.txType === "mint") {
    if (typeof script[5] === "string" && script[5].startsWith("OP_")) {
      script[5] = parseInt(script[5].slice(3), 10).toString(16);
    }
    if ((script[5] === "OP_2" && vout === 2) || parseInt(script[5], 16) === vout) {
      out.tokenId = script[4];
      out.hasBaton = true;
      return out;
    }

    if (txOut.vout !== 1) {
      throw new Error("Not a SLP txout");
    }
    out.tokenId = script[4];

    if (typeof script[6] === "string" && script[6].startsWith("OP_")) {
      script[6] = parseInt(script[6].slice(3), 10).toString(16);
    }
    out.balance = new BigNumber(script[6], 16);
  } else if (type.txType === "send") {
    if (script.length <= vout + 4) {
      throw new Error("Not a SLP txout");
    }

    out.tokenId = script[4];

    if (typeof script[vout + 4] === "string" && script[vout + 4].startsWith("OP_")) {
      script[vout + 4] = parseInt(script[vout + 4].slice(3), 10).toString(16);
    }
    out.balance = new BigNumber(script[vout + 4], 16);
  } else {
    throw new Error("Invalid tx type");
  }

  return out;
});

const decodeTokenMetadata = withSLP((SLP, txDetails) => {
  const script = SLP.Script.toASM(Buffer.from(txDetails.vout[0].scriptPubKey.hex, "hex")).split(
    " "
  );

  const type = getSLPTxType(script);

  if (type.txType === "genesis") {
    return {
      tokenId: txDetails.txid,
      symbol: Buffer.from(script[4], "hex").toString("ascii"),
      name: Buffer.from(script[5], "hex").toString("ascii"),
      decimals: script[8].startsWith("OP_")
        ? parseInt(script[8].slice(3), 10)
        : parseInt(script[8], 16),
      documentUri: Buffer.from(script[6], "hex").toString("ascii"),
      documentHash: script[7].startsWith("OP_0") ? "" : script[7]
    };
  } else {
    throw new Error("Invalid tx type");
  }
});

const revertChunk = chunkedArray =>
  chunkedArray.reduce((unchunkedArray, chunk) => [...unchunkedArray, ...chunk], []);

export default withSLP(async (SLP, addresses) => {
  const utxosResponse = await SLP.Address.utxo(addresses);
  const utxos = revertChunk(
    utxosResponse.map((utxosRespons, i) =>
      utxosRespons.utxos.map(utxo => ({ ...utxo, address: addresses[i] }))
    )
  );
  const utxoChunks = chunk(utxos, 20);
  const utxoDetails = revertChunk(
    await Promise.all(
      utxoChunks.map(utxosChunk => SLP.Transaction.details(utxosChunk.map(utxo => utxo.txid)))
    )
  );

  let tokensByTxId = {};
  utxos.forEach((utxo, i) => {
    utxo.tx = utxoDetails[i];
    try {
      utxo.slpData = decodeTxOut(utxo);
      let token = tokensByTxId[utxo.slpData.tokenId];
      if (token) {
        token.balance = token.balance.plus(utxo.slpData.balance);
        token.hasBaton = token.hasBaton || utxo.slpData.hasBaton;
      } else {
        token = utxo.slpData;
        tokensByTxId[utxo.slpData.tokenId] = token;
      }
    } catch (error) {}
  });

  let tokens = Object.values(tokensByTxId);
  const tokenIdsChunks = chunk(
    tokens.map(token => token.tokenId),
    20
  );
  const tokenTxDetails = revertChunk(
    await Promise.all(tokenIdsChunks.map(tokenIdsChunk => SLP.Transaction.details(tokenIdsChunk)))
  );

  tokens = tokens
    .filter((token, i) => {
      const tx = tokenTxDetails[i];
      try {
        token.info = decodeTokenMetadata(tx);
        token.balance = token.balance.div(Math.pow(10, token.info.decimals));
        return true;
      } catch (error) {}
      return false;
    })
    .sort((t1, t2) => t1.info.name.localeCompare(t2.info.name));

  const nonSlpUtxos = utxos.filter(utxo => !utxo.slpData && utxo.satoshis !== 546);
  const slpUtxos = utxos.filter(utxo => !!utxo.slpData);

  return { tokens, nonSlpUtxos, slpUtxos };
});
