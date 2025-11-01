import type { ProtocolAdapter, FeedInfo, DetectFeedConfig } from '../types';
import { parseAbi } from 'viem';

/**
 * Generic Adapter
 * For when you already know the feed address and just need to read its metadata
 */
export class GenericAdapter implements ProtocolAdapter {
  readonly name = 'Generic';
  readonly type = 'generic' as const;

  private readonly AGGREGATOR_ABI = parseAbi([
    'function decimals() view returns (uint8)',
    'function description() view returns (string)',
    'function latestAnswer() view returns (int256)',
  ]);

  /**
   * Generic adapter can always "handle" - it's the fallback
   */
  async canHandle(_config: DetectFeedConfig): Promise<boolean> {
    return true;
  }

  /**
   * Read feed metadata directly from the feed address
   * In this case, protocolAddress IS the feed address
   */
  async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
    const { publicClient, protocolAddress: feedAddress } = config;

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
