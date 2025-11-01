import type { DetectFeedConfig, FeedInfo, ProtocolAdapter } from './types';
import { CompoundV3Adapter } from './adapters/CompoundV3Adapter';
import { AaveV3Adapter } from './adapters/AaveV3Adapter';
import { MorphoAdapter } from './adapters/MorphoAdapter';
import { GenericAdapter } from './adapters/GenericAdapter';

/**
 * Default adapters in priority order
 */
const DEFAULT_ADAPTERS: ProtocolAdapter[] = [
  new CompoundV3Adapter(),
  new AaveV3Adapter(),
  new MorphoAdapter(),
  new GenericAdapter(), // Fallback
];

/**
 * Detect price feed for an asset across multiple protocols
 * Tries adapters in order until one succeeds
 * 
 * @param config - Detection configuration
 * @param adapters - Optional custom adapter list (defaults to all built-in adapters)
 * @returns Discovered feed information
 * 
 * @example
 * ```
 * const { publicClient } = createClients({ rpcUrl: 'http://localhost:8545', network: 'base' });
 * 
 * const feedInfo = await detectPriceFeed({
 *   publicClient,
 *   protocolAddress: '0x46e6b214b524310239732D51387075E0e70970bf', // Compound V3 USDC on Base
 *   assetAddress: '0x4200000000000000000000000000000000000006', // WETH
 * });
 * 
 * console.log(feedInfo);
 * // { address: '0x71041...', decimals: 8, description: 'ETH / USD' }
 * ```
 */
export async function detectPriceFeed(
  config: DetectFeedConfig,
  adapters: ProtocolAdapter[] = DEFAULT_ADAPTERS
): Promise<FeedInfo> {
  const errors: Array<{ adapter: string; error: Error }> = [];

  for (const adapter of adapters) {
    try {
      // Check if adapter can handle this protocol
      const canHandle = await adapter.canHandle(config);
      if (!canHandle) {
        continue;
      }

      // Try to discover feed
      const feedInfo = await adapter.discoverFeed(config);
      return feedInfo;
    } catch (error) {
      errors.push({
        adapter: adapter.name,
        error: error as Error,
      });
      // Continue to next adapter
    }
  }

  // No adapter succeeded
  throw new Error(
    `Failed to detect price feed. Tried ${adapters.length} adapters:\n` +
      errors.map((e) => `  - ${e.adapter}: ${e.error.message}`).join('\n')
  );
}
