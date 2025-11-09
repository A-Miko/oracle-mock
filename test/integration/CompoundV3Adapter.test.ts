import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { WalletClient, Address, Account } from 'viem';
import * as dotenv from 'dotenv';
dotenv.config();

import { createClients } from '../../src/client/ClientFactory';
import { CompoundV3Adapter } from '../../src/discovery/adapters/CompoundV3Adapter';
import CometArtifact from '../../artifacts/contracts/Comet.sol/Comet.json';
import MockV3AggregatorArtifact from '../../artifacts/contracts/MockV3Aggregator.sol/MockV3Aggregator.json';
import { mockCometConfig } from '../../src/mock/mockCometConfig';

describe('CompoundV3Adapter', () => {
  let walletClient: WalletClient;
  let deployer: Account;
  let mockAggregatorAddress: Address;
  let cometAddress: Address;

  before(async () => {
    deployer = privateKeyToAccount(process.env.PRIVATE_KEY as Address);
    
    walletClient = createWalletClient({
      chain: foundry,
      transport: http('http://localhost:8545'),
    });

    /**
     * Deploy Mock Aggregator
     */
    const decimals = 8;
    const initialAnswer = 1_000_000_000;
    const mockAggregatorAbi = MockV3AggregatorArtifact.abi;
    const mockAggregatorBytecode = MockV3AggregatorArtifact.bytecode;
    
    mockAggregatorAddress = await walletClient.deployContract({
      abi: mockAggregatorAbi,
      bytecode: mockAggregatorBytecode as `0x${string}`,
      args: [decimals, initialAnswer],
      account: deployer,
      chain: foundry,
    });
    mockCometConfig.baseTokenPriceFeed = mockAggregatorAddress;
    console.log(`Mock Aggregator deployed to ${mockAggregatorAddress}`);

    /**
     * Deploy Mock Comet
     */
    const cometAbi = CometArtifact.abi;
    const cometBytecode = CometArtifact.bytecode;
    
    cometAddress = await walletClient.deployContract({
      abi: cometAbi,
      bytecode: cometBytecode as `0x${string}`,
      args: [mockCometConfig],
      account: deployer,
      chain: foundry,
    });
    console.log(`Comet deployed to ${cometAddress}`);
  });

  it("should deploy MockComet and store the address", async () => {
    // expect(cometAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
    // You can now call methods on the contract using viem
  });
});
