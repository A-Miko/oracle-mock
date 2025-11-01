import type { Address } from 'viem';
import type { ProtocolAdapter, FeedInfo, DetectFeedConfig } from '../types';
import { parseAbi } from 'viem';

/**
 * Aave V3 Protocol Adapter
 * Discovers price feeds by reading from AaveOracle
 */
export class AaveV3Adapter implements ProtocolAdapter {
  readonly name = 'Aave V3';
  readonly type = 'aave-v3' as const;

  private readonly AAVE_ORACLE_ABI = parseAbi([
    'function getSourceOfAsset(address asset) view returns (address)',
  ]);

  private readonly AGGREGATOR_ABI = parseAbi([
    'function decimals() view returns (uint8)',
    'function description() view returns (string)',
  ]);

  /**
   * Check if this is an Aave V3 oracle contract
   */
  async canHandle(config: DetectFeedConfig): Promise<boolean> {
    try {
      // Try calling getSourceOfAsset - if it exists, likely Aave oracle
      await config.publicClient.readContract({
        address: config.protocolAddress,
        abi: this.AAVE_ORACLE_ABI,
        functionName: 'getSourceOfAsset',
        args: [config.assetAddress],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover price feed for an asset in Aave V3
   */
  async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
    const { publicClient, protocolAddress, assetAddress } = config;

    // Read feed address from Aave oracle
    const feedAddress = (await publicClient.readContract({
      address: protocolAddress,
      abi: this.AAVE_ORACLE_ABI,
      functionName: 'getSourceOfAsset',
      args: [assetAddress],
    })) as Address;

    // Read decimals
    const decimals = await publicClient.readContract({
      address: feedAddress,
      abi: this.AGGREGATOR_ABI,
      functionName: 'decimals',
    });

    // Try to read description
    let description: string | undefined;
    try {
      description = await publicClient.readContract({
        address: feedAddress,
        abi: this.AGGREGATOR_ABI,
        functionName: 'description',
      });
    } catch {
      // Description not available
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
  }
}
