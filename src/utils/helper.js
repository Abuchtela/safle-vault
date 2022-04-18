const cryptojs = require('crypto-js');
const safleTransactionController = require('@getsafle/transaction-controller');
const Web3 = require('web3');
const { AssetController } = require('@getsafle/asset-controller');

const Chains = require('../chains');
const ERROR_MESSAGE = require('../constants/responses');

async function stringToArrayBuffer(str) {
  const buf = new ArrayBuffer(32);
  const bufView = new Uint16Array(buf);

  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }

  return buf;
}

async function generatePrivData(mnemonic, pin) {
  var priv = {};

  const encryptedMnemonic = cryptojs.AES.encrypt(mnemonic, pin.toString()).toString();

  priv.encryptedMnemonic = encryptedMnemonic;

  return priv;
}

async function removeEmptyAccounts(indexAddress, keyringInstance, vaultState, rpcURL, etherscanApiKey, polygonscanApiKey, bscscanApiKey) {
  const web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

  const keyring = keyringInstance.getKeyringsByType(vaultState.keyrings[0].type);

  let zeroCounter = 0;
  let accountsArray = [];

  accountsArray.push({ address: indexAddress, isDeleted: false, isImported: false });

  let network;

  await web3.eth.net.getNetworkType().then((e) => network = e);

  network = network === 'main' ? network = 'mainnet' : network;

  do {
    zeroCounter = 0;
    for(let i=0; i < 5; i++) {
      const vaultState = await keyringInstance.addNewAccount(keyring[0]);

      const ethActivity = await getETHTransactions(vaultState.keyrings[0].accounts[vaultState.keyrings[0].accounts.length - 1], network, etherscanApiKey);
      const polygonActivity = await getPolygonTransactions(vaultState.keyrings[0].accounts[vaultState.keyrings[0].accounts.length - 1], 'polygon-mainnet', polygonscanApiKey);
      const bscActivity = await getBSCTransactions(vaultState.keyrings[0].accounts[vaultState.keyrings[0].accounts.length - 1], 'bsc-mainnet', bscscanApiKey);

      if (!ethActivity && !polygonActivity && !bscActivity) {
        accountsArray.push({ address: vaultState.keyrings[0].accounts[vaultState.keyrings[0].accounts.length - 1], isDeleted: true, isImported: false });
        zeroCounter++;
      } else {
        accountsArray.push({ address: vaultState.keyrings[0].accounts[vaultState.keyrings[0].accounts.length - 1], isDeleted: false, isImported: false });
        zeroCounter = 0;
      }
    }
  }

  while (zeroCounter < 5 )

  return accountsArray;
}

async function getETHTransactions(address, network, etherscanAPIKey) {
  const transactionController = new safleTransactionController.TransactionController();

  const transactions = await transactionController.getTransactions({ address, fromBlock: 0, network, apiKey: etherscanAPIKey });

  if (transactions.length > 0) {
    return true;
  }

  return false;
}

async function getPolygonTransactions(address, network, polygonscanAPIKey) {
  const transactionController = new safleTransactionController.TransactionController();

  const transactions = await transactionController.getTransactions({ address, fromBlock: 0, network, apiKey: polygonscanAPIKey });

  if (transactions.length > 0) {
    return true;
  }

  return false;
}

async function getBSCTransactions(address, network, bscscanApiKey) {
  const transactionController = new safleTransactionController.TransactionController();

  const transactions = await transactionController.getTransactions({ address, fromBlock: 0, network, apiKey: bscscanApiKey });

  if (transactions.length > 0) {
    return true;
  }

  return false;
}

async function getCoinInstance(chain, mnemonic) {
  if(Chains.evmChains.hasOwnProperty(chain)) {
    const keyringInstance = new Chains[chain].KeyringController({ });
  
    return keyringInstance;
  }

  const keyringInstance = new Chains[chain].KeyringController({ mnemonic });
  
  return keyringInstance;
}

async function getAssetDetails(addresses, EthRpcUrl, polygonRpcUrl, bscRpcUrl) {

  let output = { };

  for (let i = 0; i < addresses.length; i++) {
    if (addresses[i].isDeleted === false) {
      const ethAssets = await getEthAssets(addresses[i].address, EthRpcUrl);
    
      const polygonAssets = await getPolygonAssets(addresses[i].address, polygonRpcUrl);

      const bscAssets = await getBSCAssets(addresses[i].address, bscRpcUrl);

      output[addresses[i].address] = { eth: { ...ethAssets }, polygon: { ...polygonAssets }, bsc: { ...bscAssets } };
    }
  }

  return output;
}

async function getEthAssets(address, ethRpcUrl) {
  const assetController = new AssetController({ rpcURL: ethRpcUrl, chain: 'ethereum' });

  const tokens = await assetController.detectTokens({ userAddress: address });

  return tokens;
}

async function getPolygonAssets(address, polygonRpcUrl) {
  const assetController = new AssetController({ rpcURL: polygonRpcUrl, chain: 'polygon' });

  const tokens = await assetController.detectTokens({ userAddress: address });

  return tokens;
}

async function getBSCAssets(address, bscRpcUrl) {
  const assetController = new AssetController({ rpcURL: bscRpcUrl, chain: 'bsc' });

  const tokens = await assetController.detectTokens({ userAddress: address });

  return tokens;
}

async function cryptography(data, key, action) {
  let output;

  if (action === 'encryption') {
    output = cryptojs.AES.encrypt(data, key).toString();
  } else {
    const bytes = cryptojs.AES.decrypt(data, key);

    output = bytes.toString(cryptojs.enc.Utf8);
  }

  return output;
}

async function validateEncryptionKey(data, encryptionKey) {
  const bytes = cryptojs.AES.decrypt(data, encryptionKey);

  let decryptedVault;

  try {
      decryptedVault = JSON.parse(bytes.toString(cryptojs.enc.Utf8));
      
      return { decryptedVault };
  } catch(error) {
      return { error: ERROR_MESSAGE.INCORRECT_ENCRYPTION_KEY };
  }
}

module.exports = { stringToArrayBuffer, generatePrivData, removeEmptyAccounts, getCoinInstance, getAssetDetails, cryptography, validateEncryptionKey };
