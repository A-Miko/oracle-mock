import type { Address } from 'viem';

/**
 * Supported blockchain networks
 */
export type SupportedNetwork = 'base' | 'ethereum' | 'arbitrum' | 'optimism' | 'polygon';

/**
 * Supported DeFi protocols
 */
export type ProtocolType = 'compound-v3' | 'aave-v3' | 'morpho' | 'generic';

/**
 * Options for setting oracle price
 */
export interface SetOraclePriceOptions {
  /** RPC endpoint URL (e.g., http://127.0.0.1:8545) */
  rpcUrl: string;
  
  /** DeFi protocol type */
  protocol: ProtocolType;
  
  /** Blockchain network */
  network: SupportedNetwork;
  
  /** Protocol contract address (e.g., Compound V3 Comet) */
  protocolAddress: Address;
  
  /** Asset address (e.g., WETH, USDC) */
  assetAddress: Address;
  
  /** New absolute price (e.g., "2500" for $2500, or 2500n * 10n**8n for raw value) */
  newPrice?: string | bigint;
  
  /** Alternative: percentage change from current price (e.g., -50 for 50% crash) */
  priceChangePercent?: number;
  
  /** Private key for transactions (defaults to Anvil's default key) */
  privateKey?: `0x${string}`;
  
  /** Optional: Custom decimals (defaults to feed's decimals) */
  decimals?: 8 | 18;
}

/**
 * Result from setting oracle price
 */
export interface SetOraclePriceResult {
  success: boolean;
  feedAddress: Address;
  oldPrice: bigint;
  newPrice: bigint;
  priceChangePercent: number;
  verified: boolean;
  message: string;
}

/**
 * Options for resetting oracle price to original
 */
export interface ResetOraclePriceOptions {
  /** RPC endpoint URL */
  rpcUrl: string;
  
  /** DeFi protocol type */
  protocol: ProtocolType;
  
  /** Blockchain network */
  network: SupportedNetwork;
  
  /** Protocol contract address */
  protocolAddress: Address;
  
  /** Asset address */
  assetAddress: Address;
  
  /** Private key for transactions */
  privateKey?: `0x${string}`;
}

/**
 * Options for discovering feeds
 */
export interface DiscoverFeedsOptions {
  /** RPC endpoint URL */
  rpcUrl: string;
  
  /** Blockchain network */
  network: SupportedNetwork;
  
  /** Protocol contract address */
  protocolAddress: Address;
  
  /** Asset address */
  assetAddress: Address;
  
  /** Optional: Specific protocol type (auto-detects if not provided) */
  protocol?: ProtocolType;
}

/**
 * Mock feed deployment options (advanced)
 */
export interface DeployMockFeedOptions {
  /** RPC endpoint URL */
  rpcUrl: string;
  
  /** Blockchain network */
  network: SupportedNetwork;
  
  /** Address to deploy mock at */
  feedAddress: Address;
  
  /** Feed decimals (8 or 18) */
  decimals: 8 | 18;
  
  /** Optional initial price */
  initialPrice?: bigint;
}

/**
 * Price verification options (advanced)
 */
export interface VerifyPriceOptions {
  /** RPC endpoint URL */
  rpcUrl: string;
  
  /** Blockchain network */
  network: SupportedNetwork;
  
  /** Feed address to verify */
  feedAddress: Address;
  
  /** Expected price value */
  expectedPrice: bigint;
  
  /** Feed decimals */
  decimals?: 8 | 18;
}
