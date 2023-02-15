/**
 * @DEV: If the sandbox is throwing dependency errors, chances are you need to clear your browser history.
 * This will trigger a re-install of the dependencies in the sandbox – which should fix things right up.
 * Alternatively, you can fork this sandbox to refresh the dependencies manually.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import styled from 'styled-components';
import { Connection, PublicKey } from '@solana/web3.js';

import {
  createTransferTransactionV0,
  detectPhantomMultiChainProvider,
  getChainName,
  pollEthereumTransactionReceipt,
  pollSolanaSignatureStatus,
  sendTransactionOnEthereum,
  signAndSendTransactionOnSolana,
  signMessageOnEthereum,
  signMessageOnSolana,
} from './utils';

import {
  PhantomInjectedProvider,
  SupportedChainIcons,
  SupportedChainNames,
  SupportedEVMChainIds,
  SupportedSolanaChainIds,
  TLog,
} from './types';

import { Logs, NoProvider, Sidebar } from './components';
import { connect, silentlyConnect } from './utils/connect';
import { setupEvents } from './utils/setupEvents';
import { ensureEthereumChain } from './utils/ensureEthereumChain';
import { useEthereumChainIdState } from './utils/getEthereumChain';
import { useEthereumSelectedAddress } from './utils/getEthereumSelectedAddress';
import ERC20Contract from './utils/requests/ethERC20';
import ERC721Contract from './utils/requests/ethERC721';
import ERC1155Contract from './utils/requests/ethERC1155';
import signTypedMessageOnEthereum, { signEIP2612Message, signPermit2Message } from './utils/signTypedMessageOnEthereum';

// =============================================================================
// Styled Components
// =============================================================================

const StyledApp = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// =============================================================================
// Constants
// =============================================================================

// NB: This URL will only work for Phantom sandbox apps! Please do not use this for your project. If you are running this locally we recommend using one of Solana's public RPC endpoints
const solanaNetwork = 'https://phantom-phantom-f0ad.mainnet.rpcpool.com/';
const connection = new Connection(solanaNetwork);
const message = 'To avoid digital dognappers, sign below to authenticate with CryptoCorgis.';

// =============================================================================
// Typedefs
// =============================================================================

export type ConnectedAccounts = {
  solana: PublicKey | null;
  ethereum: string | null;
};

export type ConnectedMethod =
  | {
      chain: string;
      name: string;
      onClick: (props?: any) => Promise<string>;
    }
  | {
      chain: string;
      name: string;
      onClick: (props: { chainId?: any; address?: string }) => Promise<void | boolean>;
    };

export type ConnectedMethods = {
  [chainId in SupportedEVMChainIds & SupportedSolanaChainIds]: {
    icon: string;
    name: string;
    methods: ConnectedMethod[];
  };
};

interface Props {
  connectedAccounts: ConnectedAccounts;
  connectedEthereumChainId: SupportedEVMChainIds | undefined;
  connectedMethods: ConnectedMethods;
  handleConnect: () => Promise<void>;
  logs: TLog[];
  clearLogs: () => void;
}

// =============================================================================
// Hooks
// =============================================================================
/**
 * @DEVELOPERS
 * The fun stuff!
 */
const useProps = (provider: PhantomInjectedProvider | null): Props => {
  /** Logs to display in the Sandbox console */
  const [logs, setLogs] = useState<TLog[]>([]);

  const createLog = useCallback(
    (log: TLog) => {
      return setLogs((logs) => [...logs, log]);
    },
    [setLogs]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  const [ethereumChainId, setEthereumChainId] = useEthereumChainIdState(provider?.ethereum);
  const [ethereumSelectedAddres, setEthereumSelectedAddress] = useEthereumSelectedAddress(provider?.ethereum);

  /** Side effects to run once providers are detected */
  useEffect(() => {
    if (!provider) return;
    const { solana, ethereum } = provider;

    // attempt to eagerly connect on initial startup
    silentlyConnect({ solana, ethereum }, createLog);
    setupEvents({ solana, ethereum }, createLog, setEthereumChainId, setEthereumSelectedAddress);

    return () => {
      solana.disconnect();
    };
  }, [provider, createLog, setEthereumChainId, setEthereumSelectedAddress]);

  /** Connect to both Solana and Ethereum Providers */
  const handleConnect = useCallback(async () => {
    if (!provider) return;
    const { solana, ethereum } = provider;

    await connect({ solana, ethereum }, createLog);

    // Immediately switch to Ethereum Goerli for Sandbox purposes
    await ensureEthereumChain(ethereum, SupportedEVMChainIds.EthereumGoerli, createLog);
  }, [provider, createLog]);

  /** SignAndSendTransaction via Solana Provider */
  const handleSignAndSendTransactionOnSolana = useCallback(async () => {
    if (!provider) return;
    const { solana } = provider;
    try {
      // create a v0 transaction
      const transactionV0 = await createTransferTransactionV0(solana.publicKey, connection);
      createLog({
        providerType: 'solana',
        status: 'info',
        method: 'signAndSendTransaction',
        message: `Requesting signature for ${JSON.stringify(transactionV0)}`,
      });
      // sign and submit the transaction via Phantom
      const signature = await signAndSendTransactionOnSolana(solana, transactionV0);
      createLog({
        providerType: 'solana',
        status: 'info',
        method: 'signAndSendTransaction',
        message: `Signed and submitted transaction ${signature}.`,
      });
      // poll tx status until it is confirmed or 30 seconds pass
      pollSolanaSignatureStatus(signature, connection, createLog);
    } catch (error) {
      createLog({
        providerType: 'solana',
        status: 'error',
        method: 'signAndSendTransaction',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  /**
   * Switch Ethereum Chains
   * When a user connects to a dApp, Phantom considers them connected on all chains
   * When the Ethereum provider's chainId is changed, Phantom will not prompt the user for approval
   * */
  const isEthereumChainIdReady = useCallback(
    async (chainId: SupportedEVMChainIds) => {
      if (!provider) return false;
      const { ethereum } = provider;
      return await ensureEthereumChain(ethereum, chainId, createLog);
    },
    [provider, createLog]
  );

  /** SendTransaction via Ethereum Provider */
  const handleSendTransactionOnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        // send the transaction up to the network
        const txHash = await sendTransactionOnEthereum(ethereum);
        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );
  /** Approve ERC20 Token via Ethereum Provider */
  const handleApproveERC20TokenOnEthereum = useCallback(
    async ({ chainId, address }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const erc20Contract = new ERC20Contract(ethereum, address);

        // send the transaction up to the network
        const txHash = await erc20Contract.approve((ethereum as any).selectedAddress);

        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );

  /** Revoke ERC20 Token via Ethereum Provider */
  const handleRevokeERC20TokenOnEthereum = useCallback(
    async ({ chainId, address }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const erc20Contract = new ERC20Contract(ethereum, address);

        // send the transaction up to the network
        const txHash = await erc20Contract.revoke((ethereum as any).selectedAddress);

        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );
  const handleApproveGaslessERC20TokenOnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signTypedMessageOnEthereum(ethereum, 'v4', {
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
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData_v4',
          message: `Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData_v4',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );
  /** Approve ERC721 Token via Ethereum Provider */
  const handleApproveERC721TokenOnEthereum = useCallback(
    async ({ chainId, address }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const erc721Contract = new ERC721Contract(ethereum, address);

        // send the transaction up to the network
        const txHash = await erc721Contract.approve((ethereum as any).selectedAddress);

        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );
  /** Revoke ERC721 Token via Ethereum Provider */
  const handleRevokeERC721TokenOnEthereum = useCallback(
    async ({ chainId, address }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const erc721Contract = new ERC721Contract(ethereum, address);

        // send the transaction up to the network
        const txHash = await erc721Contract.revoke((ethereum as any).selectedAddress);

        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );
  /** Approve ERC1155 Token via Ethereum Provider */
  const handleApproveERC1155TokenOnEthereum = useCallback(
    async ({ chainId, address }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const erc1155Contract = new ERC1155Contract(ethereum, address);

        // send the transaction up to the network
        const txHash = await erc1155Contract.approve((ethereum as any).selectedAddress);

        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );
  /** Revoke ERC1155 Token via Ethereum Provider */
  const handleRevokeERC1155TokenOnEthereum = useCallback(
    async ({ chainId, address }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const erc1155Contract = new ERC1155Contract(ethereum, address);

        // send the transaction up to the network
        const txHash = await erc1155Contract.revoke((ethereum as any).selectedAddress);

        createLog({
          providerType: 'ethereum',
          status: 'info',
          method: 'eth_sendTransaction',
          message: `Sending transaction ${txHash} on ${ethereumChainId ? getChainName(ethereumChainId) : 'undefined'}`,
        });
        // poll tx status until it is confirmed in a block, fails, or 30 seconds pass
        pollEthereumTransactionReceipt(txHash, ethereum, createLog);
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_sendTransaction',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady, ethereumChainId]
  );

  // /** SignMessage via Solana Provider */
  const handleSignMessageOnSolana = useCallback(async () => {
    if (!provider) return;
    const { solana } = provider;
    try {
      const signedMessage = await signMessageOnSolana(solana, message);
      createLog({
        providerType: 'solana',
        status: 'success',
        method: 'signMessage',
        message: `Message signed: ${JSON.stringify(signedMessage)}`,
      });
      return signedMessage;
    } catch (error) {
      createLog({
        providerType: 'solana',
        status: 'error',
        method: 'signMessage',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  /** SignMessage via Ethereum Provider */
  const handleSignMessageOnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signMessageOnEthereum(ethereum, message);
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'personal_sign',
          message: `Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'personal_sign',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );
  /** SignTypedMessage (v1) via Ethereum Provider */
  // https://eips.ethereum.org/EIPS/eip-712
  const handleSignTypedMessageV1OnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signTypedMessageOnEthereum(ethereum, 'v1');
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData',
          message: `Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );
  /** SignTypedMessage (v3) via Ethereum Provider */
  const handleSignTypedMessageV3OnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signTypedMessageOnEthereum(ethereum, 'v3');
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData_v3',
          message: `Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData_v3',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );
  /** SignTypedMessage (v4) via Ethereum Provider */
  const handleSignTypedMessageV4OnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signTypedMessageOnEthereum(ethereum, 'v4');
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData_v4',
          message: `Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData_v4',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );

  /** SignTypedMessage (v4) via Ethereum Provider using ethers.js */
  const handleSignTypedMessageWithEthersOnEthereum = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signTypedMessageOnEthereum(ethereum, 'ethers');
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData',
          message: `Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );
  /** SignTypedMessage (v4) via Ethereum Provider using ethers.js */
  const handleSignPermit2Message = useCallback(
    async ({ chainId, value }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signPermit2Message(ethereum, value);
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData',
          message: `Permit2 Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );
  const handleSignEIP2612Message = useCallback(
    async ({ chainId }) => {
      // set ethereum provider to the correct chainId
      const ready = await isEthereumChainIdReady(chainId);
      if (!ready) return;
      const { ethereum } = provider;
      try {
        const signedMessage = await signEIP2612Message(ethereum);
        createLog({
          providerType: 'ethereum',
          status: 'success',
          method: 'eth_signTypedData',
          message: `EIP2612 Message signed: ${signedMessage}`,
        });
        return signedMessage;
      } catch (error) {
        createLog({
          providerType: 'ethereum',
          status: 'error',
          method: 'eth_signTypedData',
          message: error.message,
        });
      }
    },
    [provider, createLog, isEthereumChainIdReady]
  );

  /**
   * Disconnect from Solana
   * At this time, there is no way to programmatically disconnect from Ethereum
   * MULTI-CHAIN PROVIDER TIP: You can only disconnect on the solana provider. But after when disconnecting your should use the
   * multi-chain connect method to reconnect.
   */
  const handleDisconnect = useCallback(async () => {
    if (!provider) return;
    const { solana } = provider;
    try {
      await solana.disconnect();
    } catch (error) {
      createLog({
        providerType: 'solana',
        status: 'error',
        method: 'disconnect',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  const connectedMethods = useMemo(() => {
    function createEvmMethods({
      erc20Address,
      erc721Address,
      erc1155Address,
    }: {
      erc20Address: string;
      erc721Address: string;
      erc1155Address: string;
    }) {
      return [
        {
          name: 'Send Transaction',
          onClick: handleSendTransactionOnEthereum,
        },
        // EIP20: https://eips.ethereum.org/EIPS/eip-20 (transfer, approve)
        [
          {
            name: 'Approve ERC20 Token',
            onClick: handleApproveERC20TokenOnEthereum,
            args: {
              address: erc20Address,
            },
          },
          {
            name: 'Revoke ERC20 Token',
            onClick: handleRevokeERC20TokenOnEthereum,
            args: {
              address: erc20Address,
            },
          },
          {
            name: 'Approve Gasless ERC20 Token',
            onClick: handleApproveGaslessERC20TokenOnEthereum,
            args: {
              address: erc20Address,
            },
          },
        ],
        // EIP721: https://eips.ethereum.org/EIPS/eip-721 (approve)
        // Approve an address to send the NFT
        [
          {
            name: 'Approve ERC721 Token',
            onClick: handleApproveERC721TokenOnEthereum,
            args: {
              address: erc721Address,
            },
          },
          {
            name: 'Revoke ERC721 Token',
            onClick: handleRevokeERC721TokenOnEthereum,
            args: {
              address: erc721Address,
            },
          },
        ],
        // EIP1155: https://eips.ethereum.org/EIPS/eip-1155 (setApprovalForAll)
        // Approve an address to send the NFT
        [
          {
            name: 'Approve ERC1155 Token (all)',
            onClick: handleApproveERC1155TokenOnEthereum,
            args: {
              address: erc1155Address,
            },
          },
          {
            name: 'Revoke ERC1155 Token (all)',
            onClick: handleRevokeERC1155TokenOnEthereum,
            args: {
              address: erc1155Address,
            },
          },
        ],
        {
          name: 'Sign Message',
          onClick: handleSignMessageOnEthereum,
        },
        [
          {
            name: 'Sign Typed Message (v1)',
            onClick: handleSignTypedMessageV1OnEthereum,
          },
          {
            name: 'Sign Typed Message (v3)',
            onClick: handleSignTypedMessageV3OnEthereum,
          },
          {
            name: 'Sign Typed Message (v4)',
            onClick: handleSignTypedMessageV4OnEthereum,
          },
          {
            name: 'Sign Typed Message (ethers)',
            onClick: handleSignTypedMessageWithEthersOnEthereum,
          },
        ],
        [
          {
            name: 'Permit2',
            onClick: handleSignPermit2Message,
          },
          {
            name: 'Permit2 (Small amount)',
            onClick: ({ chainId }) => handleSignPermit2Message({ chainId, value: 0.5 * 1e18 }),
          },
          {
            name: 'EIP2612',
            onClick: handleSignEIP2612Message,
          },
        ],
      ];
    }

    return {
      [SupportedEVMChainIds.EthereumGoerli]: {
        icon: SupportedChainIcons.Ethereum,
        name: SupportedChainNames.EthereumGoerli,
        methods: createEvmMethods({
          // sushi ethereum mainnet
          erc20Address: '0x1a63bbb6e16f7fc7d34817496985757cd550c2c0',
          // Azuki goerli test (https://testnets.opensea.io/collection/azukigoerli)
          erc721Address: '0x10b8b56d53bfa5e374f38e6c0830bad4ebee33e6',
          // kitties #1 (https://testnets.opensea.io/collection/kitties-1-1)
          erc1155Address: '0xf4910c763ed4e47a585e2d34baa9a4b611ae448c',
        }),
      },
      [SupportedEVMChainIds.PolygonMainnet]: {
        icon: SupportedChainIcons.Polygon,
        name: SupportedChainNames.PolygonMainnet,
        methods: createEvmMethods({
          // sushi polygon mainnet
          erc20Address: '0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a',
          // polygon ape YC (https://opensea.io/collection/polygonapeyachtclub)
          erc721Address: '0x419e82d502f598ca63d821d3bbd8dfefaf9bbc8d',
          // Mocaverse Realm Ticket (https://opensea.io/collection/mocaverse-realm-ticket)
          erc1155Address: '0x5c76677fea2bf5dd37e4f1460968a23a537e3ee3',
        }),
      },
      [SupportedSolanaChainIds.SolanaMainnet]: {
        icon: SupportedChainIcons.Solana,
        name: SupportedChainNames.SolanaMainnet,
        methods: [
          {
            name: 'Sign and Send Transaction',
            onClick: handleSignAndSendTransactionOnSolana,
          },

          {
            name: 'Sign Message',
            onClick: handleSignMessageOnSolana,
          },
          {
            name: 'Disconnect',
            onClick: handleDisconnect,
          },
        ],
      },
    };
  }, [
    handleSignAndSendTransactionOnSolana,
    handleSendTransactionOnEthereum,
    handleSignMessageOnSolana,
    handleSignMessageOnEthereum,
    handleApproveERC20TokenOnEthereum,
    handleApproveERC721TokenOnEthereum,
    handleApproveERC1155TokenOnEthereum,
    handleApproveGaslessERC20TokenOnEthereum,
    handleRevokeERC20TokenOnEthereum,
    handleRevokeERC721TokenOnEthereum,
    handleRevokeERC1155TokenOnEthereum,
    handleSignTypedMessageV1OnEthereum,
    handleSignTypedMessageV3OnEthereum,
    handleSignTypedMessageV4OnEthereum,
    handleSignTypedMessageWithEthersOnEthereum,
    handleSignPermit2Message,
    handleSignEIP2612Message,
    handleDisconnect,
  ]);

  return {
    connectedAccounts: {
      solana: provider?.solana?.publicKey,
      ethereum: ethereumSelectedAddres,
    },
    connectedEthereumChainId: ethereumChainId,
    connectedMethods,
    handleConnect,
    logs,
    clearLogs,
  };
};

// =============================================================================
// Stateless Component
// =============================================================================

const StatelessApp = React.memo((props: Props) => {
  const { connectedAccounts, connectedEthereumChainId, connectedMethods, handleConnect, logs, clearLogs } = props;

  return (
    <ChakraProvider>
      <StyledApp>
        <Sidebar
          connectedAccounts={connectedAccounts}
          connectedEthereumChainId={connectedEthereumChainId}
          connectedMethods={connectedMethods}
          connect={handleConnect}
        />
        <Logs connectedAccounts={connectedAccounts} logs={logs} clearLogs={clearLogs} />
      </StyledApp>
    </ChakraProvider>
  );
});

// =============================================================================
// Main Component
// =============================================================================

const App = () => {
  const [provider, setProvider] = useState<PhantomInjectedProvider | null>(null);
  const props = useProps(provider);

  useEffect(() => {
    const getPhantomMultiChainProvider = async () => {
      const phantomMultiChainProvider = await detectPhantomMultiChainProvider();
      setProvider(phantomMultiChainProvider);
    };
    getPhantomMultiChainProvider();
  }, []);

  if (!provider) {
    return <NoProvider />;
  }

  return <StatelessApp {...props} />;
};

export default App;
