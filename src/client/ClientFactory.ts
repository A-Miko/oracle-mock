import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Account,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, mainnet, arbitrum, optimism, polygon } from 'viem/chains';

/**
 * Supported network names
 */
export type SupportedNetwork =
  | 'base'
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'localhost';

/**
 * Client configuration options
 */
export interface ClientConfig {
  /** RPC URL to connect to */
  rpcUrl: string;
  /** Predefined network name (optional if chain is provided) */
  network?: SupportedNetwork;
  /** Custom chain configuration (optional if network is provided) */
  chain?: Chain;
  /** Private key for wallet client (optional) */
  privateKey?: `0x${string}`;
  /** Account object for wallet client (optional, overrides privateKey) */
  account?: Account;
}

/**
 * Created clients bundle
 */
export interface Clients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  chain: Chain;
}

/**
 * Get chain configuration from network name
 * 
 * @param network - Network name
 * @returns Chain configuration object
 * 
 * @example
 * ```
 * const baseChain = getChainFromNetwork('base');
 * console.log(baseChain.id); // 8453
 * ```
 */
export function getChainFromNetwork(network: SupportedNetwork): Chain {
  const chains: Record<SupportedNetwork, Chain> = {
    base,
    ethereum: mainnet,
    arbitrum,
    optimism,
    polygon,
    localhost: {
      id: 31337,
      name: 'Localhost',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['http://127.0.0.1:8545'] },
        public: { http: ['http://127.0.0.1:8545'] },
      },
    },
  };

  return chains[network];
}

/**
 * Create viem public and wallet clients for blockchain interaction
 * 
 * @param config - Client configuration
 * @returns PublicClient and WalletClient instances with chain info
 * 
 * @example
 * ```
 * // Using network name
 * const { publicClient, walletClient } = createClients({
 *   rpcUrl: 'http://localhost:8545',
 *   network: 'base'
 * });
 * 
 * // Using custom chain
 * const { publicClient, walletClient } = createClients({
 *   rpcUrl: 'http://localhost:8545',
 *   chain: customChain
 * });
 * 
 * // With private key for wallet
 * const { publicClient, walletClient } = createClients({
 *   rpcUrl: 'http://localhost:8545',
 *   network: 'base',
 *   privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
 * });
 * 
 * // Read blockchain state
 * const blockNumber = await publicClient.getBlockNumber();
 * 
 * // Sign and send transactions (requires privateKey or account)
 * const hash = await walletClient.sendTransaction({
 *   to: '0x...',
 *   value: 1000000000000000000n
 * });
 * ```
 */
export function createClients(config: ClientConfig): Clients {
  const { rpcUrl, network, chain: customChain, privateKey, account: customAccount } = config;

  // Determine chain to use
  let chain: Chain;
  if (customChain) {
    chain = customChain;
  } else if (network) {
    chain = getChainFromNetwork(network);
  } else {
    // Default to localhost if neither provided
    chain = getChainFromNetwork('localhost');
  }

  // Create transport
  const transport = http(rpcUrl);

  // Create public client (for reading blockchain state)
  const publicClient = createPublicClient({
    chain,
    transport,
  });

  // Determine account for wallet client
  let account: Account | undefined;
  if (customAccount) {
    account = customAccount;
  } else if (privateKey) {
    account = privateKeyToAccount(privateKey);
  }

  // Create wallet client (for signing transactions)
  const walletClient = createWalletClient({
    chain,
    transport,
    account,
  });

  return {
    publicClient,
    walletClient,
    chain,
  };
}

/**
 * Detect which fork testing framework is being used
 * Returns 'hardhat', 'foundry', or 'unknown' based on RPC capabilities
 * 
 * @param publicClient - Viem public client
 * @returns Framework type
 * 
 * @example
 * ```
 * const { publicClient } = createClients({ rpcUrl: 'http://localhost:8545' });
 * const framework = await detectForkFramework(publicClient);
 * console.log(framework); // 'hardhat' or 'foundry'
 * ```
 */
export async function detectForkFramework(
  publicClient: PublicClient
): Promise<'hardhat' | 'foundry' | 'unknown'> {
  try {
    // Try Hardhat-specific method
    await (publicClient.request as any)({
      method: 'hardhat_getAutomine',
      params: [],
    });
    return 'hardhat';
  } catch {
    // Not Hardhat, try Foundry/Anvil
    try {
      await (publicClient.request as any)({
        method: 'anvil_nodeInfo',
        params: [],
      });
      return 'foundry';
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Get the appropriate setCode method name for the detected framework
 * 
 * @param publicClient - Viem public client
 * @returns Method name for setting bytecode
 * 
 * @example
 * ```
 * const { publicClient } = createClients({ rpcUrl: 'http://localhost:8545' });
 * const method = await getSetCodeMethod(publicClient);
 * 
 * // Use it to set bytecode
 * await publicClient.request({
 *   method: method as any,
 *   params: [address, bytecode]
 * });
 * ```
 */
export async function getSetCodeMethod(
  publicClient: PublicClient
): Promise<'hardhat_setCode' | 'anvil_setCode'> {
  const framework = await detectForkFramework(publicClient);

  if (framework === 'hardhat') {
    return 'hardhat_setCode';
  } else if (framework === 'foundry') {
    return 'anvil_setCode';
  }

  // Default to hardhat (more common)
  return 'hardhat_setCode';
}

/**
 * Set bytecode at an address (works with both Hardhat and Foundry)
 * 
 * @param publicClient - Viem public client
 * @param address - Address to set bytecode at
 * @param bytecode - Hex bytecode string
 * 
 * @example
 * ```
 * const { publicClient } = createClients({ rpcUrl: 'http://localhost:8545' });
 * await setBytecode(publicClient, '0x...', '0x6080604052...');
 * ```
 */
export async function setBytecode(
  publicClient: PublicClient,
  address: Address,
  bytecode: `0x${string}`
): Promise<void> {
  const method = await getSetCodeMethod(publicClient);

  await (publicClient.request as any)({
    method: method,
    params: [address, bytecode],
  });
}
