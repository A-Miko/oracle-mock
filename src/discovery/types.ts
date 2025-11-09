import type { Address, PublicClient, WalletClient, Chain } from 'viem';

/**
 * Information about a discovered price feed
 */
export interface FeedInfo {
  /** Address of the price feed contract */
  address: Address;
  /** Decimal precision of the price feed (8 or 18) */
  decimals: number;
  /** Optional human-readable description */
  description?: string;
  /** Optional asset symbol (e.g., "WETH", "USDC") */
  assetSymbol?: string;
}

/**
 * Supported protocol types
 */
export type ProtocolType = 'compound-v3' | 'morpho' | 'aave-v3';

/**
 * Configuration for feed detection
 */
export interface DetectFeedConfig {
  /** Public client for blockchain reads */
  publicClient: PublicClient;
  /** Protocol contract address */
  protocolAddress: Address;
  /** Asset address to find feed for */
  assetAddress: Address;
  /** Optional protocol type hint */
  protocolType?: ProtocolType;
}

/**
 * Base interface for protocol adapters
 */
export interface ProtocolAdapter {
  /** Adapter name */
  readonly name: string;
  
  /** Protocol type */
  readonly type: ProtocolType;

  /** Chain object */
  readonly chain: Chain;

  /** Deployer address */
  readonly deployer: Address;

  /** Public client for blockchain reads */
  publicClient: PublicClient;

  /** Wallet client for blockchain writes */
  walletClient: WalletClient;

  deployMockAggregator(decimals: number, initialPrice: bigint): Promise<FeedInfo>;

  updatePrice(mockAggregator: Address, newPrice: bigint): Promise<void>;

  updatePriceByPercentage(mockAggregator: Address, percentage: number): Promise<void>;
}

export interface ProtocolAdapterConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  chain: Chain;
  name: string;
  type: ProtocolType;
  deployer: Address;
}

export abstract class ProtocolAdapterBase implements ProtocolAdapter {
  readonly name: string;
  readonly type: ProtocolType;
  readonly chain: Chain;
  readonly deployer: Address;

  public publicClient: PublicClient;
  public walletClient: WalletClient;

  constructor(config: ProtocolAdapterConfig) {
    this.name = config.name;
    this.type = config.type;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.chain = config.chain;
    this.deployer = config.deployer;
  }

  async deployMockAggregator(decimals: number, initialPrice: bigint): Promise<FeedInfo> {
    throw new Error('Not implemented');
  }

  async updatePrice(feedAddress: Address, newPrice: bigint): Promise<void> {
    throw new Error('Not implemented');
  }

  async updatePriceByPercentage(feedAddress: Address, percentage: number): Promise<void> {
    throw new Error('Not implemented');
  }
}
