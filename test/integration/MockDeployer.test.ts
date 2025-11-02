import { expect } from 'chai';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import {
  deployMockAtAddress,
  isMockDeployed,
  getMockFeedInfo,
} from '../../src/mock/MockDeployer';
import {
  setPrice,
  setPriceWithPercentageChange,
  getCurrentPrice,
  resetPrice,
  formatPrice,
  parsePrice,
  getDecimals,
  setPriceWithBidirectionalFactor
} from '../../src/mock/PriceSetter';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Mock Deployment & Price Setting - Integration Tests', () => {
  let publicClient: any;
  let walletClient: any;
  let account: any;

  const TEST_FEED_ADDRESS = '0x1111111111111111111111111111111111111111';
  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  before(async () => {
    const rpcUrl = 'http://127.0.0.1:8545';

    // Create account from private key
    account = privateKeyToAccount(TEST_PRIVATE_KEY);

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
  });

  describe('MockDeployer', () => {
    it('should deploy 8-decimal mock feed', async function () {
      this.timeout(10000);

      const mockFeed = await deployMockAtAddress({
        feedAddress: TEST_FEED_ADDRESS,
        decimals: 8,
        publicClient,
      });

      expect(mockFeed.address).to.equal(TEST_FEED_ADDRESS);
      expect(mockFeed.decimals).to.equal(8);
    });

    it('should check if mock is deployed', async function () {
      this.timeout(10000);

      const isDeployed = await isMockDeployed(TEST_FEED_ADDRESS, publicClient);
      expect(isDeployed).to.be.true;
    });

    it('should get mock feed info', async function () {
      this.timeout(10000);

      const info = await getMockFeedInfo(TEST_FEED_ADDRESS, publicClient);

      expect(info.decimals).to.equal(8);
      expect(info.currentPrice).to.equal(0n);
    });
  });

  describe('PriceSetter', () => {
    it('should set absolute price', async function () {
      this.timeout(10000);

      const newPrice = 200000000000n; // $2000 with 8 decimals

      await setPrice({
        feedAddress: TEST_FEED_ADDRESS,
        publicClient,
        walletClient,
        account: account.address,
        newPrice,
        decimals: 8,
      });

      const currentPrice = await getCurrentPrice(TEST_FEED_ADDRESS, publicClient);
      expect(currentPrice).to.equal(newPrice);
    });

    it('should set price with percentage change', async function () {
      this.timeout(10000);

      const initialPrice = await getCurrentPrice(TEST_FEED_ADDRESS, publicClient);

      await setPriceWithPercentageChange({
        feedAddress: TEST_FEED_ADDRESS,
        publicClient,
        walletClient,
        account: account.address,
        percentageChange: -20, // Decrease by 20%
        decimals: 8,
      });

      const newPrice = await getCurrentPrice(TEST_FEED_ADDRESS, publicClient);
      const expectedPrice = (initialPrice * 80n) / 100n;

      expect(newPrice).to.equal(expectedPrice);
    });

    it('should reset price to zero', async function () {
      this.timeout(10000);

      await resetPrice(
        TEST_FEED_ADDRESS,
        publicClient,
        walletClient,
        account.address,
        8
      );

      const currentPrice = await getCurrentPrice(TEST_FEED_ADDRESS, publicClient);
      expect(currentPrice).to.equal(0n);
    });

    it('should format and parse prices correctly', () => {
      const price = parsePrice('2000.50', 8);
      expect(price).to.equal(200050000000n);

      const formatted = formatPrice(200050000000n, 8);
      expect(formatted).to.equal('2000.50000000');
    });
  });

  describe('PriceSetter - Advanced Functions', () => {
    it('should get decimals from deployed mock', async function () {
      this.timeout(10000);

      const decimals = await getDecimals(TEST_FEED_ADDRESS, publicClient);
      expect(decimals).to.equal(8);
    });

    it('should handle setPriceWithBidirectionalFactor without oracle validator', async function () {
      this.timeout(25000);

      // Set initial price
      await setPrice({
        feedAddress: TEST_FEED_ADDRESS,
        publicClient,
        walletClient,
        account: account.address,
        newPrice: 100000000000n, // $1000
        decimals: 8,
      });

      // Apply bidirectional factor (should default to forward direction)
      const result = await setPriceWithBidirectionalFactor({
        feedAddress: TEST_FEED_ADDRESS,
        publicClient,
        walletClient,
        account: account.address,
        percentageChange: -10, // Try to decrease by 10%
        decimals: 8,
      });

      expect(result.success).to.be.true;
      expect(result.newPrice).to.not.equal(result.oldPrice);
    });

    it('should handle positive percentage change with bidirectional factor', async function () {
      this.timeout(25000);

      const initialPrice = await getCurrentPrice(TEST_FEED_ADDRESS, publicClient);

      const result = await setPriceWithBidirectionalFactor({
        feedAddress: TEST_FEED_ADDRESS,
        publicClient,
        walletClient,
        account: account.address,
        percentageChange: 20, // Increase by 20%
        decimals: 8,
      });

      expect(result.success).to.be.true;
      expect(result.newPrice).to.be.greaterThan(Number(initialPrice));
    });

    it('should handle edge case: zero price with bidirectional factor', async function () {
      this.timeout(25000);

      // Reset to zero
      await resetPrice(TEST_FEED_ADDRESS, publicClient, walletClient, account.address, 8);

      // Try to apply percentage change to zero price
      try {
        await setPriceWithBidirectionalFactor({
          feedAddress: TEST_FEED_ADDRESS,
          publicClient,
          walletClient,
          account: account.address,
          percentageChange: -10,
          decimals: 8,
        });
        expect.fail('Should have thrown error for zero price');
      } catch (error: any) {
        expect(error.message).to.include('Cannot apply percentage change: current price is 0');
      }
    });
  });

  describe('Integration with Compound V3', () => {
    it('should verify Compound V3 reads from manipulated price feed', async function () {
      this.timeout(30000);

      // Real Compound V3 USDC Comet on Base
      const COMPOUND_COMET = '0xb125E6687d4313864e53df431d5425969c15Eb2F';
      
      // Real WETH price feed used by Compound V3 on Base
      // You need to find the actual feed address Compound uses for WETH
      const WETH_PRICE_FEED = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'; // Example - verify this!

      // Step 1: Get Compound's view of the price BEFORE manipulation
      const cometAbi = parseAbi([
        'function getPrice(address) view returns (uint256)',
      ]);

      const priceBefore = await publicClient.readContract({
        address: COMPOUND_COMET,
        abi: cometAbi,
        functionName: 'getPrice',
        args: [WETH_PRICE_FEED],
      });

      console.log(`📊 Compound V3 WETH price BEFORE: ${formatPrice(priceBefore, 8)}`);

      // Step 2: Deploy mock at the WETH price feed address
      await deployMockAtAddress({
        feedAddress: WETH_PRICE_FEED,
        decimals: 8,
        publicClient,
      });

      // Step 3: Set a manipulated price (e.g., crash WETH to $1000)
      const manipulatedPrice = parsePrice('1000', 8);
      
      await setPrice({
        feedAddress: WETH_PRICE_FEED,
        publicClient,
        walletClient,
        account: account.address,
        newPrice: manipulatedPrice,
        decimals: 8,
      });

      console.log(`💰 Set WETH price to: ${formatPrice(manipulatedPrice, 8)}`);

      // Step 4: Get Compound's view of the price AFTER manipulation
      const priceAfter = await publicClient.readContract({
        address: COMPOUND_COMET,
        abi: cometAbi,
        functionName: 'getPrice',
        args: [WETH_PRICE_FEED],
      });

      console.log(`📊 Compound V3 WETH price AFTER: ${formatPrice(priceAfter, 8)}`);

      // Step 5: Verify Compound V3 now reads the manipulated price
      expect(priceAfter).to.equal(manipulatedPrice);
      expect(priceAfter).to.not.equal(priceBefore);
      
      console.log('✅ Compound V3 ACTUALLY reads the manipulated price!');
      console.log(`✅ Price changed from ${formatPrice(priceBefore, 8)} → ${formatPrice(priceAfter, 8)}`);
    });
  });
});
