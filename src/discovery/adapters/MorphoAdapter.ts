import type { ProtocolAdapter, FeedInfo, DetectFeedConfig } from '../types';
import { parseAbi } from 'viem';

/**
 * Morpho Blue Protocol Adapter
 * Discovers price feeds by reading oracle address from market params
 */
export class MorphoAdapter implements ProtocolAdapter {
  readonly name = 'Morpho Blue';
  readonly type = 'morpho' as const;

  private readonly MORPHO_ABI = parseAbi([
    'function idToMarketParams(bytes32 id) view returns (address, address, address, address, uint256)',
  ]);

  private readonly ORACLE_ABI = parseAbi([
    'function price() view returns (uint256)',
  ]);

  private readonly AGGREGATOR_ABI = parseAbi([
    'function decimals() view returns (uint8)',
    'function description() view returns (string)',
  ]);

  /**
   * Check if this is a Morpho Blue contract
   */
  async canHandle(config: DetectFeedConfig): Promise<boolean> {
    try {
      // Morpho uses market IDs - we'd need the ID to test properly
      // For now, just check if idToMarketParams exists
      // This is a simplified check
      return config.protocolType === 'morpho';
    } catch {
      return false;
    }
  }

  /**
   * Discover price feed for an asset in Morpho
   * Note: Morpho uses market IDs, so this requires knowing the market structure
   */
  async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
    const { publicClient, protocolAddress } = config;

    // For Morpho, the oracle address is in the market params
    // This is a simplified implementation - real usage would need market ID
    throw new Error(
      'Morpho adapter requires market ID. Use CompoundV3Adapter or AaveAdapter for direct asset lookup.'
    );

    // Example of how it would work with a market ID:
    // const marketParams = await publicClient.readContract({
    //   address: protocolAddress,
    //   abi: this.MORPHO_ABI,
    //   functionName: 'idToMarketParams',
    //   args: [marketId],
    // });
    //
    // const oracleAddress = marketParams[2]; // oracle is 3rd element
    // ... then read decimals from oracle
  }
}
