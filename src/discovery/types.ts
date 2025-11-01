import type { Address, PublicClient } from 'viem';
import type { OracleDecimals } from '../artifacts/ArtifactLoader';

/**
 * Information about a discovered price feed
 */
export interface FeedInfo {
  /** Address of the price feed contract */
  address: Address;
  /** Decimal precision of the price feed (8 or 18) */
  decimals: OracleDecimals;
  /** Optional human-readable description */
  description?: string;
  /** Optional asset symbol (e.g., "WETH", "USDC") */
  assetSymbol?: string;
}

/**
 * Supported protocol types
 */
export type ProtocolType = 'compound-v3' | 'morpho' | 'aave-v3' | 'generic';

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
  
  /**
   * Detect if this adapter can handle the given protocol
   */
  canHandle(config: DetectFeedConfig): Promise<boolean>;
  
  /**
   * Discover price feed for an asset
   */
  discoverFeed(config: DetectFeedConfig): Promise<FeedInfo>;
}
