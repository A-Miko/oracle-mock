import type { Address, PublicClient, WalletClient } from 'viem';

/**
 * Handle for an deployed mock feed
 */
export interface MockFeedHandle {
  address: Address;
  decimals: 8 | 18;
  publicClient: PublicClient;
}

/**
 * Options for deploying a mock feed
 */
export interface DeployMockOptions {
  feedAddress: Address;
  decimals: 8 | 18;
  publicClient: PublicClient;
}

/**
 * Options for setting an absolute price
 */
export interface SetPriceOptions {
  feedAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  newPrice: bigint;
  decimals: 8 | 18;
}

/**
 * Options for setting price with percentage change
 */
export interface PriceChangeOptions {
  feedAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  percentageChange: number; // e.g., -20 for 20% decrease, 50 for 50% increase
  decimals: 8 | 18;
}

/**
 * Result of a price change operation
 */
export interface PriceChangeResult {
  success: boolean;
  oldPrice: bigint;
  newPrice: bigint;
  transactionHash: string;
}
