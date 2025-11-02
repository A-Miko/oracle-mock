import { expect } from 'chai';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { verifyPriceChange } from '../../src/validation/PriceVerifier';
import { verifyProtocolSeesPrice } from '../../src/validation/ProtocolVerifier';
import { deployMockAtAddress } from '../../src/mock/MockDeployer';
import { setPrice } from '../../src/mock/PriceSetter';
import { parsePrice } from '../../src/utils/DecimalConverter';
import * as dotenv from 'dotenv';

dotenv.config();

describe.only('Validation Layer - Integration Tests', () => {
  let publicClient: any;
  let walletClient: any;
  let account: any;

  // Test constants
  const TEST_FEED_ADDRESS = '0x3333333333333333333333333333333333333333';
  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil default
  const COMPOUND_COMET_ADDRESS = '0xb125E6687d4313864e53df431d5425969c15Eb2F'; // Compound V3 USDC on Base
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // WETH on Base

  before(async () => {
    const rpcUrl = 'http://127.0.0.1:8545';

    // Create account from private key
    account = privateKeyToAccount(TEST_PRIVATE_KEY);

    // Create public client for reading
    publicClient = createPublicClient({
      chain: foundry,
      transport: http(rpcUrl),
    });

    // Create wallet client for writing transactions
    walletClient = createWalletClient({
      account,
      chain: foundry,
      transport: http(rpcUrl),
    });

    // Deploy a mock feed for testing
    await deployMockAtAddress({
      feedAddress: TEST_FEED_ADDRESS,
      decimals: 8,
      publicClient,
    });

    // Set an initial price
    await setPrice({
      feedAddress: TEST_FEED_ADDRESS,
      publicClient,
      walletClient,
      account: account.address,
      newPrice: 100000000000n, // $1000
      decimals: 8,
    });
  });

  describe('PriceVerifier', () => {
    it('should verify price matches expected value', async function () {
      this.timeout(10000);

      const result = await verifyPriceChange(
        TEST_FEED_ADDRESS,
        100000000000n, // Expected: $1000
        publicClient,
        8
      );

      expect(result.success).to.be.true;
      expect(result.match).to.be.true;
      expect(result.actualPrice).to.equal(100000000000n);
    });

    it('should detect price mismatch', async function () {
      this.timeout(10000);

      const result = await verifyPriceChange(
        TEST_FEED_ADDRESS,
        200000000000n, // Expected: $2000 (but actual is $1000)
        publicClient,
        8
      );

      expect(result.success).to.be.true;
      expect(result.match).to.be.false;
      expect(result.actualPrice).to.equal(100000000000n);
      expect(result.expectedPrice).to.equal(200000000000n);
    });

    it('should verify price with tolerance', async function () {
      this.timeout(10000);

      const { verifyPriceChangeWithTolerance } = await import('../../src/validation/PriceVerifier');

      const result = await verifyPriceChangeWithTolerance(
        TEST_FEED_ADDRESS,
        100100000000n, // Expected: $1001 (within 0.1% of $1000)
        publicClient,
        0.1, // 0.1% tolerance
        8
      );

      expect(result.success).to.be.true;
      expect(result.match).to.be.true;
    });
  });

  describe('ProtocolVerifier', () => {
    it('should verify Compound V3 sees correct price for WETH', async function () {
      this.timeout(30000);

      // First, find the price feed Compound uses for WETH
      const { parseAbi } = await import('viem');
      const assetInfoAbi = parseAbi([
        'function getAssetInfoByAddress(address) view returns (uint8, address, address, uint64, uint64, uint64, uint64, uint128)',
      ]);

      const assetInfo = await publicClient.readContract({
        address: COMPOUND_COMET_ADDRESS,
        abi: assetInfoAbi,
        functionName: 'getAssetInfoByAddress',
        args: [WETH_ADDRESS],
      });

      const wethPriceFeed = assetInfo[2]; // 3rd element is priceFeed
      console.log(`📍 WETH price feed: ${wethPriceFeed}`);

      // Deploy mock at the actual WETH price feed address
      await deployMockAtAddress({
        feedAddress: wethPriceFeed,
        decimals: 8,
        publicClient,
      });

      // Set a manipulated price
      const manipulatedPrice = parsePrice('1500', 8); // $1500 WETH
      await setPrice({
        feedAddress: wethPriceFeed,
        publicClient,
        walletClient,
        account: account.address,
        newPrice: manipulatedPrice,
        decimals: 8,
      });

      // Verify Compound V3 sees the manipulated price
      const result = await verifyProtocolSeesPrice(
        COMPOUND_COMET_ADDRESS,
        WETH_ADDRESS,
        manipulatedPrice,
        publicClient,
        'compound-v3',
        8
      );

      expect(result.success).to.be.true;
      expect(result.match).to.be.true;
      expect(result.actualPrice).to.equal(manipulatedPrice);
      console.log('✅ Compound V3 successfully reads manipulated price!');
    });

    it('should handle protocol verification errors gracefully', async function () {
      this.timeout(10000);

      // Try to verify with a non-existent asset
      const FAKE_ASSET = '0x0000000000000000000000000000000000000001';

      const result = await verifyProtocolSeesPrice(
        COMPOUND_COMET_ADDRESS,
        FAKE_ASSET,
        100000000000n,
        publicClient,
        'compound-v3',
        8
      );

      expect(result.success).to.be.false;
      expect(result.match).to.be.false;
    });
  });

  describe('End-to-End Validation Workflow', () => {
    it('should perform complete price manipulation and verification', async function () {
      this.timeout(30000);

      // 1. Deploy mock
      const testFeed = '0x4444444444444444444444444444444444444444';
      await deployMockAtAddress({
        feedAddress: testFeed,
        decimals: 8,
        publicClient,
      });

      // 2. Set price
      const targetPrice = parsePrice('3000', 8);
      await setPrice({
        feedAddress: testFeed,
        publicClient,
        walletClient,
        account: account.address,
        newPrice: targetPrice,
        decimals: 8,
      });

      // 3. Verify price change
      const verifyResult = await verifyPriceChange(
        testFeed,
        targetPrice,
        publicClient,
        8
      );

      expect(verifyResult.success).to.be.true;
      expect(verifyResult.match).to.be.true;
      expect(verifyResult.actualPrice).to.equal(targetPrice);

      console.log('✅ End-to-end validation workflow completed successfully!');
    });

    it('should verify multiple sequential price changes', async function () {
      this.timeout(15000);
      
      const testFeed = '0x5555555555555555555555555555555555555555';
      
      await deployMockAtAddress({ feedAddress: testFeed, decimals: 8, publicClient });
      
      // Price change 1: $1000
      await setPrice({ 
        feedAddress: testFeed, 
        publicClient, 
        walletClient, 
        account: account.address, 
        newPrice: parsePrice('1000', 8), 
        decimals: 8 
      });
      
      let result = await verifyPriceChange(testFeed, parsePrice('1000', 8), publicClient, 8);
      expect(result.match).to.be.true;
      
      // Price change 2: $2000
      await setPrice({ 
        feedAddress: testFeed, 
        publicClient, 
        walletClient, 
        account: account.address, 
        newPrice: parsePrice('2000', 8), 
        decimals: 8 
      });
      
      result = await verifyPriceChange(testFeed, parsePrice('2000', 8), publicClient, 8);
      expect(result.match).to.be.true;
      
      // Price change 3: $500 (crash)
      await setPrice({ 
        feedAddress: testFeed, 
        publicClient, 
        walletClient, 
        account: account.address, 
        newPrice: parsePrice('500', 8), 
        decimals: 8 
      });
      
      result = await verifyPriceChange(testFeed, parsePrice('500', 8), publicClient, 8);
      expect(result.match).to.be.true;
      
      console.log('✅ Sequential price changes verified: $1000 → $2000 → $500');
    });

    it('should verify 18-decimal feed prices', async function () {
      this.timeout(10000);
      
      const testFeed18 = '0x6666666666666666666666666666666666666666';
      
      await deployMockAtAddress({ feedAddress: testFeed18, decimals: 18, publicClient });
      
      // Set price with 18 decimals
      const price18 = parsePrice('2500.5', 18); // $2500.50
      await setPrice({ 
        feedAddress: testFeed18, 
        publicClient, 
        walletClient, 
        account: account.address, 
        newPrice: price18, 
        decimals: 18 
      });
      
      const result = await verifyPriceChange(testFeed18, price18, publicClient, 18);
      
      expect(result.match).to.be.true;
      expect(result.actualPrice).to.equal(price18);
      
      console.log('✅ 18-decimal verification passed');
    });
  });
});
