import { ethers } from 'ethers';
import { PhantomEthereumProvider } from '../types';
import { getEthereumSelectedAddress } from './getEthereumSelectedAddress';

const defaultMsgParams = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    from: {
      name: 'Cow',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
    contents: 'Hello, Bob!',
  },
};

/**
 * Signs a message on Ethereum
 * @param provider a Phantom ethereum provider
 * @param message a message to sign
 * @returns a signed message is hex string format
 */
const signTypedMessageOnEthereum = async (
  provider: PhantomEthereumProvider,
  version: 'v1' | 'v3' | 'v4' | 'ethers',
  msgParams: object = defaultMsgParams
): Promise<string> => {
  try {
    const selectedAddress = await getEthereumSelectedAddress(provider);

    let signedMessage;

    switch (version) {
      case 'v1':
        signedMessage = await signTypedMessageV1(selectedAddress, provider);
        break;
      case 'v3':
        signedMessage = await signTypedMessageV3(selectedAddress, provider, msgParams);
        break;
      case 'v4':
        signedMessage = await signTypedMessageV4(selectedAddress, provider, msgParams);
        break;
      case 'ethers':
        signedMessage = await signTypedMessageUsingEthers(provider, msgParams);
        break;
    }

    if (typeof signedMessage === 'string') return signedMessage;
    throw new Error('personal_sign did not respond with a signature');
  } catch (error) {
    console.warn(error);
    throw new Error(error.message);
  }
};

const signTypedMessageV1 = async (selectedAddress: string, provider: PhantomEthereumProvider) => {
  return provider.request({
    method: 'eth_signTypedData',
    params: [
      [
        {
          type: 'string', // Any valid solidity type
          name: 'Message', // Any string label you want
          value: 'Hi, Alice!', // The value to sign
        },
        {
          type: 'uint32',
          name: 'A number',
          value: '1337',
        },
      ],
      selectedAddress,
    ],
  });
};

const signTypedMessageV3 = async (selectedAddress: string, provider: PhantomEthereumProvider, msgParams) => {
  return provider.request({
    method: 'eth_signTypedData_v3',
    params: [selectedAddress, msgParams],
  });
};

// https://eips.ethereum.org/assets/eip-712/Example.js
const signTypedMessageV4 = async (selectedAddress: string, provider: PhantomEthereumProvider, msgParams) => {
  return provider.request({
    method: 'eth_signTypedData_v4',
    params: [selectedAddress, msgParams],
  });
};

// https://eips.ethereum.org/assets/eip-712/Example.js
const signTypedMessageUsingEthers = async (provider: PhantomEthereumProvider, msgParams) => {
  const params = { ...msgParams };
  delete params.types.EIP712Domain;

  const ethersProvider = new ethers.providers.Web3Provider(provider as ethers.providers.ExternalProvider);
  return ethersProvider.getSigner()._signTypedData(msgParams.domain, msgParams.types, msgParams.message);
};

export const signPermit2Message = async (
  provider: PhantomEthereumProvider,
  value = '1461501637330902918203684832716283019655932542975'
) => {
  const selectedAddress = await getEthereumSelectedAddress(provider);

  return signTypedMessageV4(selectedAddress, provider, {
    domain: { chainId: '1', name: 'Permit2', verifyingContract: '0x000000000022d473030f116ddee9f6b43ac78ba3' },
    message: {
      details: {
        token: '0x6b175474e89094c44da98b954eedeac495271d0f',
        amount: value,
        expiration: '1679042624',
        nonce: '0',
      },
      spender: '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b',
      sigDeadline: '1676452424',
    },
    primaryType: 'PermitSingle',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
      ],
    },
  });
};
export const signEIP2612Message = async (provider: PhantomEthereumProvider) => {
  const selectedAddress = await getEthereumSelectedAddress(provider);

  return signTypedMessageV4(selectedAddress, provider, {
    domain: {
      chainId: 1,
      name: 'Dai Stablecoin',
      verifyingContract: '0x6b175474e89094c44da98b954eedeac495271d0f',
      version: '1',
    },
    message: {
      expiry: 1674899371,
      nonce: 1,
      spender: '0x1111111254eeb25477b68fb85ed929f73a960582',
      holder: '0x3ed5fffe493d4066191d7b7e76784a33defd0018',
      allowed: true,
    },
    primaryType: 'Permit',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'holder', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
        { name: 'allowed', type: 'bool' },
      ],
    },
  });
};

export default signTypedMessageOnEthereum;
