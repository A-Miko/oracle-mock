import type { Address } from 'viem';
import type { FeedInfo, ProtocolType } from '../types';
import { ProtocolAdapterBase } from '../types';
import MockV3AggregatorArtifact from '../../../artifacts/contracts/MockV3Aggregator.sol/MockV3Aggregator.json';

/**
 * Compound V3 (Comet) Protocol Adapter
 */
export class CompoundV3Adapter extends ProtocolAdapterBase {
  readonly name = 'Compound V3';
  readonly type: ProtocolType = 'compound-v3';

  async deployMockAggregator(decimals: number, initialPrice: bigint = 100000000n): Promise<FeedInfo> {
    // Deploy MockV3Aggregator with 8 decimals and initial price 1e8 (100.00)
    const { abi, bytecode } = MockV3AggregatorArtifact;
    const address = await this.walletClient.deployContract({
      abi,
      bytecode: bytecode as `0x${string}`,
      args: [decimals, initialPrice], // constructor args,
      account: this.deployer,
      chain: this.chain,
    });
    console.log('Deployed MockV3Aggregator at', address);

    return {
      address,
      decimals,
      description: 'Mock feed',
    };
  }

  async updatePrice(feedAddress: Address, newPrice: bigint): Promise<void> {
  }

  async updatePriceByPercentage(feedAddress: Address, percentage: number): Promise<void> {
  }
}
