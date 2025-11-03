import { expect } from 'chai';
import {
  setOraclePrice,
  resetOraclePrice,
  discoverFeeds,
  deployMockFeed,
  verifyPrice,
} from '../../src/api/SimpleAPI';
import type { Address } from 'viem';
import * as dotenv from 'dotenv';
import { createClients } from '../../src/client/ClientFactory';

dotenv.config();

describe.only('Simple API - Integration Tests', () => {
  // Test configuration
  const RPC_URL = 'http://127.0.0.1:8545';
  const NETWORK = 'localhost' as const;
  const PROTOCOL = 'compound-v3' as const;
  
  // Compound V3 on Base
  const COMPOUND_COMET_ADDRESS = '0xb125E6687d4313864e53df431d5425969c15Eb2F' as Address;
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as Address;
  
  // Collateral assets
  const CBETH_ADDRESS = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' as Address;
  const WSTETH_ADDRESS = '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452' as Address;

  // Anvil default private key
  const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  // Snapshot ID to revert to
  let snapshotId: string;

  // Create initial snapshot before all tests
  before(async () => {
    const { publicClient } = createClients({
      rpcUrl: RPC_URL,
      network: NETWORK,
    });
    
    // Take a snapshot of the initial state
    snapshotId = await publicClient.request({
      method: 'evm_snapshot' as any,
    }) as string;
    
    console.log(`\n📸 Created initial snapshot: ${snapshotId}\n`);
  });

  // Revert to snapshot before each test
  beforeEach(async () => {
    const { publicClient } = createClients({
      rpcUrl: RPC_URL,
      network: NETWORK,
    });
    
    // Revert to the initial snapshot
    await publicClient.request({
      method: 'evm_revert' as any,
      params: [snapshotId],
    } as any);
    
    // Take a NEW snapshot for the next revert
    snapshotId = await publicClient.request({
      method: 'evm_snapshot' as any,
    }) as string;
    
    console.log('🔄 Reset: Reverted to clean snapshot\n');
  });

  describe('setOraclePrice()', () => {
    it('should set oracle price using percentage change', async () => {
      console.log('\n📝 Test: Set WETH price with -30% change');
      
      const result = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: CBETH_ADDRESS,
        priceChangePercent: -30,
        privateKey: PRIVATE_KEY,
      });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.feedAddress).to.be.a('string');
      expect(result.oldPrice).to.be.a('bigint');
      expect(result.newPrice).to.be.a('bigint');
      expect(result.newPrice < result.oldPrice).to.be.true;
      expect(result.priceChangePercent).to.be.closeTo(-30, 0.1);
      expect(result.verified).to.be.true;
      expect(result.message).to.include('Price changed');

      console.log(`   ✅ Result: ${result.message}`);
    });

    it('should set oracle price using absolute value (string)', async () => {
      console.log('\n📝 Test: Set WETH price to $2500');
      
      const result = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: CBETH_ADDRESS,
        newPrice: '2500', // $2500
        privateKey: PRIVATE_KEY,
      });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.newPrice).to.equal(250000000000n); // $2500 with 8 decimals
      expect(result.verified).to.be.true;

      console.log(`   ✅ Result: ${result.message}`);
    });

    it('should set oracle price using absolute value (bigint)', async () => {
      console.log('\n📝 Test: Set WETH price to $3000 (bigint)');
      
      const result = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: CBETH_ADDRESS,
        newPrice: 300000000000n, // $3000 with 8 decimals
        privateKey: PRIVATE_KEY,
      });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.newPrice).to.equal(300000000000n);
      expect(result.verified).to.be.true;

      console.log(`   ✅ Result: ${result.message}`);
    });

    it('should increase price by positive percentage', async () => {
      console.log('\n📝 Test: Increase cbETH price by +50%');
      
      const result = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: CBETH_ADDRESS,
        priceChangePercent: 50,
        privateKey: PRIVATE_KEY,
      });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.newPrice > result.oldPrice).to.be.true;
      expect(result.priceChangePercent).to.be.closeTo(50, 0.1);
      expect(result.verified).to.be.true;

      console.log(`   ✅ Result: ${result.message}`);
    });

    it('should work with custom decimals', async () => {
      console.log('\n📝 Test: Set price with custom decimals override');
      
      const result = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: CBETH_ADDRESS,
        newPrice: '2000',
        decimals: 8, // Explicitly set decimals
        privateKey: PRIVATE_KEY,
      });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.verified).to.be.true;

      console.log(`   ✅ Result: ${result.message}`);
    });

    it('should throw error when neither newPrice nor priceChangePercent provided', async () => {
      console.log('\n📝 Test: Error handling - missing price parameters');
      
      try {
        await setOraclePrice({
          rpcUrl: RPC_URL,
          protocol: PROTOCOL,
          network: NETWORK,
          protocolAddress: COMPOUND_COMET_ADDRESS,
          assetAddress: WETH_ADDRESS,
          // Neither newPrice nor priceChangePercent provided
          privateKey: PRIVATE_KEY,
        });
        
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Either newPrice or priceChangePercent must be provided');
        console.log(`   ✅ Error caught: ${error.message}`);
      }
    });

    it('should handle extreme percentage changes', async () => {
      console.log('\n📝 Test: Extreme price crash (-90%)');
      
      const result = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        priceChangePercent: -90,
        privateKey: PRIVATE_KEY,
      });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.priceChangePercent).to.be.closeTo(-90, 0.1);
      expect(result.newPrice).to.be.a('bigint');
      expect(result.newPrice < result.oldPrice).to.be.true;
      expect(result.priceChangePercent).to.be.closeTo(-90, 0.1);

      console.log(`   ✅ Result: ${result.message}`);
    });
  });

  describe('resetOraclePrice()', () => {
    it('should reset price after manipulation', async () => {
      console.log('\n📝 Test: Reset price after change');
      
      // Step 1: Change price
      console.log('   Step 1: Changing price by -40%...');
      const changeResult = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        priceChangePercent: -40,
        privateKey: PRIVATE_KEY,
      });

      expect(changeResult.success).to.be.true;
      const originalPrice = changeResult.oldPrice;
      const manipulatedPrice = changeResult.newPrice;
      
      console.log(`   Original: $${(Number(originalPrice) / 1e8).toFixed(2)}`);
      console.log(`   Manipulated: $${(Number(manipulatedPrice) / 1e8).toFixed(2)}`);

      // Step 2: Reset price
      console.log('   Step 2: Resetting to original price...');
      await resetOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        privateKey: PRIVATE_KEY,
      });

      console.log(`   ✅ Price reset successfully`);
    });

    it('should throw error when resetting without prior manipulation', async () => {
      console.log('\n📝 Test: Error handling - reset without prior change');
      
      // Use a different asset that hasn't been manipulated
      const UNUSED_ASSET = '0x0000000000000000000000000000000000000001' as Address;
      
      try {
        await resetOraclePrice({
          rpcUrl: RPC_URL,
          protocol: PROTOCOL,
          network: 'ethereum' as const, // Different network
          protocolAddress: COMPOUND_COMET_ADDRESS,
          assetAddress: UNUSED_ASSET,
          privateKey: PRIVATE_KEY,
        });
        
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('No original price found');
        console.log(`   ✅ Error caught: ${error.message}`);
      }
    });
  });

  describe('discoverFeeds()', () => {
    it('should discover price feed for WETH on Compound V3', async () => {
      console.log('\n📝 Test: Discover WETH price feed');
      
      const feedInfo = await discoverFeeds({
        rpcUrl: RPC_URL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        protocol: PROTOCOL,
      });

      // Assertions
      expect(feedInfo).to.be.an('object');
      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
    //   expect(feedInfo.protocol).to.equal('compound-v3');

      console.log(`   ✅ Feed found: ${feedInfo.address}`);
      console.log(`   Decimals: ${feedInfo.decimals}`);
      console.log(`   Description: ${feedInfo.description || 'N/A'}`);
    });

    it('should discover price feed for cbETH on Compound V3', async () => {
      console.log('\n📝 Test: Discover cbETH price feed');
      
      const feedInfo = await discoverFeeds({
        rpcUrl: RPC_URL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: CBETH_ADDRESS,
        protocol: PROTOCOL,
      });

      // Assertions
      expect(feedInfo).to.be.an('object');
      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);

      console.log(`   ✅ Feed found: ${feedInfo.address}`);
    });

    it('should auto-detect protocol when not specified', async () => {
      console.log('\n📝 Test: Auto-detect protocol');
      
      const feedInfo = await discoverFeeds({
        rpcUrl: RPC_URL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        // protocol not specified - should auto-detect
      });

      // Assertions
      expect(feedInfo).to.be.an('object');
      expect(feedInfo.address).to.be.a('string');
    //   expect(feedInfo.protocol).to.be.a('string');

    //   console.log(`   ✅ Auto-detected protocol: ${feedInfo.protocol}`);
    });
  });

  describe('deployMockFeed()', () => {
    it('should deploy mock feed at specific address', async () => {
      console.log('\n📝 Test: Deploy mock feed');
      
      const mockAddress = '0x9999999999999999999999999999999999999999' as Address;
      
      await deployMockFeed({
        rpcUrl: RPC_URL,
        network: NETWORK,
        feedAddress: mockAddress,
        decimals: 8,
      });

      console.log(`   ✅ Mock feed deployed at ${mockAddress}`);
    });

    it('should deploy mock feed with initial price', async () => {
      console.log('\n📝 Test: Deploy mock with initial price');
      
      const mockAddress = '0x8888888888888888888888888888888888888888' as Address;
      const initialPrice = 150000000000n; // $1500 with 8 decimals
      
      await deployMockFeed({
        rpcUrl: RPC_URL,
        network: NETWORK,
        feedAddress: mockAddress,
        decimals: 8,
        initialPrice,
      });

      console.log(`   ✅ Mock deployed with initial price: $1500`);
    });
  });

  describe('verifyPrice()', () => {
    it('should verify correct price at feed', async () => {
      console.log('\n📝 Test: Verify price at feed');
      
      // First, set a known price
      const knownPrice = 280000000000n; // $2800
      await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        newPrice: knownPrice,
        privateKey: PRIVATE_KEY,
      });

      // Then verify it
      const feedInfo = await discoverFeeds({
        rpcUrl: RPC_URL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
      });

      const isCorrect = await verifyPrice({
        rpcUrl: RPC_URL,
        network: NETWORK,
        feedAddress: feedInfo.address,
        expectedPrice: knownPrice,
        decimals: 8,
      });

      expect(isCorrect).to.be.true;
      console.log(`   ✅ Price verified successfully`);
    });

    it('should return false for incorrect price', async () => {
      console.log('\n📝 Test: Detect incorrect price');
      
      const feedInfo = await discoverFeeds({
        rpcUrl: RPC_URL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
      });

      const wrongPrice = 999999999999n; // Obviously wrong price
      
      const isCorrect = await verifyPrice({
        rpcUrl: RPC_URL,
        network: NETWORK,
        feedAddress: feedInfo.address,
        expectedPrice: wrongPrice,
        decimals: 8,
      });

      expect(isCorrect).to.be.false;
      console.log(`   ✅ Incorrect price detected`);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full manipulation and verification cycle', async () => {
      console.log('\n📝 Test: Full E2E workflow');
      
      // Step 1: Discover feed
      console.log('   Step 1: Discovering feed...');
      const feedInfo = await discoverFeeds({
        rpcUrl: RPC_URL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        protocol: PROTOCOL,
      });
      expect(feedInfo.address).to.be.a('string');
      console.log(`   ✅ Feed: ${feedInfo.address}`);

      // Step 2: Set price with percentage change
      console.log('   Step 2: Manipulating price (-25%)...');
      const result1 = await setOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        priceChangePercent: -25,
        privateKey: PRIVATE_KEY,
      });
      expect(result1.success).to.be.true;
      expect(result1.verified).to.be.true;
      console.log(`   ✅ Price changed: ${result1.message}`);

      // Step 3: Verify the new price
      console.log('   Step 3: Verifying price...');
      const isCorrect = await verifyPrice({
        rpcUrl: RPC_URL,
        network: NETWORK,
        feedAddress: feedInfo.address,
        expectedPrice: result1.newPrice,
        decimals: 8,
      });
      expect(isCorrect).to.be.true;
      console.log(`   ✅ Price verified`);

      // Step 4: Reset to original
      console.log('   Step 4: Resetting price...');
      await resetOraclePrice({
        rpcUrl: RPC_URL,
        protocol: PROTOCOL,
        network: NETWORK,
        protocolAddress: COMPOUND_COMET_ADDRESS,
        assetAddress: WETH_ADDRESS,
        privateKey: PRIVATE_KEY,
      });
      console.log(`   ✅ Price reset complete`);

      // Step 5: Verify reset
      console.log('   Step 5: Verifying reset...');
      const isReset = await verifyPrice({
        rpcUrl: RPC_URL,
        network: NETWORK,
        feedAddress: feedInfo.address,
        expectedPrice: result1.oldPrice,
        decimals: 8,
      });
      expect(isReset).to.be.true;
      console.log(`   ✅ Reset verified`);

      console.log('\n   🎉 Full E2E workflow completed successfully!');
    });
  });
});
