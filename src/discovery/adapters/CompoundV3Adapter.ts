import type { Address } from 'viem';
import type { ProtocolAdapter, FeedInfo, DetectFeedConfig } from '../types';
import { parseAbi } from 'viem';

/**
 * AssetInfo tuple returned by Compound V3 getAssetInfoByAddress
 */
type AssetInfo = readonly [
  number,    // offset
  Address,   // asset
  Address,   // priceFeed
  bigint,    // scale
  bigint,    // borrowCollateralFactor
  bigint,    // liquidateCollateralFactor
  bigint,    // liquidationFactor
  bigint     // supplyCap
];

/**
 * Compound V3 (Comet) Protocol Adapter
 * Discovers price feeds by reading getAssetInfoByAddress()
 */
export class CompoundV3Adapter implements ProtocolAdapter {
  readonly name = 'Compound V3';
  readonly type: 'compound-v3' = 'compound-v3';

  // Simplified ABI without named tuple fields
  private readonly COMET_ABI = parseAbi([
    'function getAssetInfoByAddress(address asset) view returns (uint8, address, address, uint64, uint64, uint64, uint64, uint128)',
    'function baseToken() view returns (address)',
  ]);

  private readonly AGGREGATOR_ABI = parseAbi([
    'function decimals() view returns (uint8)',
    'function description() view returns (string)',
  ]);

  /**
   * Check if this is a Compound V3 (Comet) contract
   */
  async canHandle(config: DetectFeedConfig): Promise<boolean> {
    try {
      // Try calling baseToken - if it exists, likely Compound V3
      await config.publicClient.readContract({
        address: config.protocolAddress,
        abi: this.COMET_ABI,
        functionName: 'baseToken',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover price feed for an asset in Compound V3
   */
  async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
    const { publicClient, protocolAddress, assetAddress } = config;

    try {
      // Read asset info from Comet
      const assetInfo = (await publicClient.readContract({
        address: protocolAddress,
        abi: this.COMET_ABI,
        functionName: 'getAssetInfoByAddress',
        args: [assetAddress],
      })) as AssetInfo;

      const feedAddress = assetInfo[2]; // priceFeed is 3rd element (index 2)

      // Check if the asset has a valid price feed configured
      if (!feedAddress || feedAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Failed to discover feed: Asset not found in Comet or no price feed configured');
      }

      // Read decimals from the price feed
      const decimals = (await publicClient.readContract({
        address: feedAddress,
        abi: this.AGGREGATOR_ABI,
        functionName: 'decimals',
      })) as number;

      // Try to read description (optional)
      let description: string | undefined;
      try {
        description = (await publicClient.readContract({
          address: feedAddress,
          abi: this.AGGREGATOR_ABI,
          functionName: 'description',
        })) as string;
      } catch {
        // Description not available
        description = undefined;
      }

      // Validate decimals
      if (decimals !== 8 && decimals !== 18) {
        throw new Error(`Unsupported feed decimals: ${decimals} (expected 8 or 18)`);
      }

      return {
        address: feedAddress,
        decimals: decimals as 8 | 18,
        description,
      };
    } catch (error: any) {
      // Wrap any error in a consistent format
      if (error.message?.includes('Failed to discover feed')) {
        throw error; // Re-throw if already our custom error
      }
      throw new Error(`Failed to discover feed: ${error.message || 'Unknown error'}`);
    }
  }
}
