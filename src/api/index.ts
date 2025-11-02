/**
 * @miko/oracle-mock
 * 
 * Manipulate Chainlink oracle prices in local test environments
 * for DeFi protocol testing (liquidations, collateral ratios, etc.)
 * 
 * @example
 * ```
 * import { setOraclePrice } from '@miko/oracle-mock';
 * 
 * // Crash WETH price by 50% to trigger liquidations
 * await setOraclePrice({
 *   rpcUrl: 'http://127.0.0.1:8545',
 *   protocol: 'compound-v3',
 *   network: 'base',
 *   protocolAddress: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
 *   assetAddress: '0x4200000000000000000000000000000000000006', // WETH
 *   priceChangePercent: -50,
 * });
 * ```
 */

// ============================================================================
// SIMPLE API (Recommended for most users)
// ============================================================================

export {
  setOraclePrice,
  resetOraclePrice,
} from '../api/SimpleAPI';

// ============================================================================
// ADVANCED API (For power users)
// ============================================================================

export {
  discoverFeeds,
  deployMockFeed,
  verifyPrice,
} from '../api/SimpleAPI';

// ============================================================================
// LOW-LEVEL API (For building custom tools)
// ============================================================================

// Mock Management
export { deployMockAtAddress } from '../mock/MockDeployer';
export { setPrice, setPriceWithPercentageChange, getCurrentPrice } from '../mock/PriceSetter';

// Feed Discovery
export { detectPriceFeed } from '../discovery/FeedDetector';
export { CompoundV3Adapter } from '../discovery/adapters/CompoundV3Adapter';

// Validation
export { verifyPriceChange } from '../validation/PriceVerifier';
export { verifyProtocolSeesPrice } from '../validation/ProtocolVerifier';

// Utilities
export { formatPrice, parsePrice } from '../utils/DecimalConverter';
export { createClients, type Clients } from '../client/ClientFactory';
export {
  detectRpcProvider,
  getSetCodeMethod,
  getMineMethod,
  isHardhat,
  isAnvil,
} from '../utils/ChainDetector';
export {
  calculateStorageSlot,
  setStorageAt,
  getStorageAt,
} from '../utils/StorageHelper';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // API Types
  SetOraclePriceOptions,
  SetOraclePriceResult,
  ResetOraclePriceOptions,
  DiscoverFeedsOptions,
  DeployMockFeedOptions,
  VerifyPriceOptions,
  ProtocolType,
  SupportedNetwork,
} from '../api/types';

// Discovery Types
export type {
  FeedInfo,
  DetectFeedConfig,
  ProtocolAdapter,
} from '../discovery/types';

// Mock Types
export type {
  DeployMockOptions,
  SetPriceOptions,
  PriceChangeOptions,
  PriceChangeResult,
} from '../mock/types';

// Validation Types
export type {
  PriceVerificationResult,
} from '../validation/PriceVerifier';

// Client Types
export type {
  ClientConfig,
} from '../client/ClientFactory';
