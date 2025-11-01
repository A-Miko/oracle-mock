import { expect } from 'chai';
import { detectPriceFeed } from '../../src/discovery/FeedDetector';
import { CompoundV3Adapter } from '../../src/discovery/adapters/CompoundV3Adapter';
import type { ProtocolAdapter, FeedInfo, DetectFeedConfig } from '../../src/discovery/types';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import type { PublicClient } from 'viem';
import * as dotenv from 'dotenv';
dotenv.config();

describe('FeedDetector - Integration Tests', () => {
  let publicClient: PublicClient;
  let publicClientMainnet: PublicClient;

  const BASE_COMET_USDC = '0x46e6b214b524310239732D51387075E0e70970bf';
  const BASE_cbETH = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22';
  const BASE_WSTETH = '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452';
  
  // Invalid/non-protocol addresses for testing
  const INVALID_PROTOCOL = '0x1234567890123456789012345678901234567890';
  const RANDOM_EOA = '0x0000000000000000000000000000000000000001';

  before(async () => {
    publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL),
    }) as PublicClient;

    // Add delay after CompoundV3Adapter tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should auto-detect Compound V3 and discover feed', async () => {
    const feedInfo = await detectPriceFeed({
      publicClient,
      protocolAddress: BASE_COMET_USDC,
      assetAddress: BASE_cbETH,
    });

    expect(feedInfo.address).to.be.a('string');
    // cbETH/ETH feed on Base uses 18 decimals, not 8
    expect(feedInfo.decimals).to.be.oneOf([8, 18]);
  });

  it('should work with explicit protocol type hint', async () => {
    const feedInfo = await detectPriceFeed({
      publicClient,
      protocolAddress: BASE_COMET_USDC,
      assetAddress: BASE_cbETH,
      protocolType: 'compound-v3',
    });

    expect(feedInfo.decimals).to.be.oneOf([8, 18]);
  });

  describe('Basic Detection', () => {
    it('should auto-detect Compound V3 and discover feed', async function() {
      this.timeout(10000);
      
      const feedInfo = await detectPriceFeed({
        publicClient,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
    });

    it('should work with explicit protocol type hint', async function() {
      this.timeout(10000);
      
      const feedInfo = await detectPriceFeed({
        publicClient,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
        protocolType: 'compound-v3',
      });

      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
    });
  });

  describe('1. Multiple Adapter Fallback Logic', () => {
    it('should try multiple adapters when first one fails', async function() {
      this.timeout(15000);
      
      // Create a mock adapter that always fails
      class FailingAdapter implements ProtocolAdapter {
        readonly name = 'Failing Adapter';
        readonly type = 'failing' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          // This adapter will say it can handle, but then fail
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Failing adapter intentionally fails');
        }
      }

      // Create custom adapter list with failing adapter first, then real one
      const customAdapters: ProtocolAdapter[] = [
        new FailingAdapter(),
        new CompoundV3Adapter(),
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should succeed by falling back to CompoundV3Adapter
      const feedInfo = await detectPriceFeed(
        {
          publicClient,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_cbETH,
        },
        customAdapters
      );

      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
    });

    it('should skip adapters that cannot handle the protocol', async function() {
      this.timeout(15000);
      
      // Create a mock adapter that cannot handle the protocol
      class NonHandlingAdapter implements ProtocolAdapter {
        readonly name = 'Non-Handling Adapter';
        readonly type = 'non-handling' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          // This adapter will say it cannot handle
          return false;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          // Should never be called
          throw new Error('This should not be called');
        }
      }

      const customAdapters: ProtocolAdapter[] = [
        new NonHandlingAdapter(),
        new CompoundV3Adapter(),
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should succeed by skipping first adapter and using CompoundV3Adapter
      const feedInfo = await detectPriceFeed(
        {
          publicClient,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_cbETH,
        },
        customAdapters
      );

      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
    });
  });

  describe('2. All Adapters Fail Scenario', () => {
    it('should throw aggregated error when all adapters fail', async function() {
      this.timeout(15000);
      
      // Create multiple mock adapters that all fail
      class FailingAdapter1 implements ProtocolAdapter {
        readonly name = 'Failing Adapter 1';
        readonly type = 'failing1' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('First adapter error');
        }
      }

      class FailingAdapter2 implements ProtocolAdapter {
        readonly name = 'Failing Adapter 2';
        readonly type = 'failing2' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Second adapter error');
        }
      }

      class FailingAdapter3 implements ProtocolAdapter {
        readonly name = 'Failing Adapter 3';
        readonly type = 'failing3' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Third adapter error');
        }
      }

      const customAdapters: ProtocolAdapter[] = [
        new FailingAdapter1(),
        new FailingAdapter2(),
        new FailingAdapter3(),
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should throw error with all adapter errors aggregated
      try {
        await detectPriceFeed(
          {
            publicClient,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_cbETH,
          },
          customAdapters
        );
        
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Verify error message contains all adapter errors
        expect(error.message).to.include('Failed to detect price feed');
        expect(error.message).to.include('Tried 3 adapters');
        expect(error.message).to.include('Failing Adapter 1');
        expect(error.message).to.include('First adapter error');
        expect(error.message).to.include('Failing Adapter 2');
        expect(error.message).to.include('Second adapter error');
        expect(error.message).to.include('Failing Adapter 3');
        expect(error.message).to.include('Third adapter error');
      }
    });

    it('should throw error when no adapters can handle protocol', async function() {
      this.timeout(15000);
      
      // Create adapters that cannot handle the protocol
      class NonHandlingAdapter1 implements ProtocolAdapter {
        readonly name = 'Non-Handling Adapter 1';
        readonly type = 'non-handling1' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return false;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Should not be called');
        }
      }

      class NonHandlingAdapter2 implements ProtocolAdapter {
        readonly name = 'Non-Handling Adapter 2';
        readonly type = 'non-handling2' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return false;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Should not be called');
        }
      }

      const customAdapters: ProtocolAdapter[] = [
        new NonHandlingAdapter1(),
        new NonHandlingAdapter2(),
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await detectPriceFeed(
          {
            publicClient,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_cbETH,
          },
          customAdapters
        );
        
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Failed to detect price feed');
        expect(error.message).to.include('Tried 2 adapters');
      }
    });

    it('should throw error with invalid protocol address', async function() {
      this.timeout(15000);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await detectPriceFeed({
          publicClient,
          protocolAddress: INVALID_PROTOCOL as any,
          assetAddress: BASE_cbETH,
        });
        
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Failed to detect price feed');
      }
    });
  });

  describe('2. All Adapters Fail Scenario', () => {
    it('should throw aggregated error when all adapters fail', async function() {
      this.timeout(15000);
      
      // Create multiple mock adapters that all fail
      class FailingAdapter1 implements ProtocolAdapter {
        readonly name = 'Failing Adapter 1';
        readonly type = 'failing1' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('First adapter error');
        }
      }

      class FailingAdapter2 implements ProtocolAdapter {
        readonly name = 'Failing Adapter 2';
        readonly type = 'failing2' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Second adapter error');
        }
      }

      class FailingAdapter3 implements ProtocolAdapter {
        readonly name = 'Failing Adapter 3';
        readonly type = 'failing3' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return true;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Third adapter error');
        }
      }

      const customAdapters: ProtocolAdapter[] = [
        new FailingAdapter1(),
        new FailingAdapter2(),
        new FailingAdapter3(),
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should throw error with all adapter errors aggregated
      try {
        await detectPriceFeed(
          {
            publicClient,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_cbETH,
          },
          customAdapters
        );
        
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Verify error message contains all adapter errors
        expect(error.message).to.include('Failed to detect price feed');
        expect(error.message).to.include('Tried 3 adapters');
        expect(error.message).to.include('Failing Adapter 1');
        expect(error.message).to.include('First adapter error');
        expect(error.message).to.include('Failing Adapter 2');
        expect(error.message).to.include('Second adapter error');
        expect(error.message).to.include('Failing Adapter 3');
        expect(error.message).to.include('Third adapter error');
      }
    });

    it('should throw error when no adapters can handle protocol', async function() {
      this.timeout(15000);
      
      // Create adapters that cannot handle the protocol
      class NonHandlingAdapter1 implements ProtocolAdapter {
        readonly name = 'Non-Handling Adapter 1';
        readonly type = 'non-handling1' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return false;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Should not be called');
        }
      }

      class NonHandlingAdapter2 implements ProtocolAdapter {
        readonly name = 'Non-Handling Adapter 2';
        readonly type = 'non-handling2' as any;

        async canHandle(config: DetectFeedConfig): Promise<boolean> {
          return false;
        }

        async discoverFeed(config: DetectFeedConfig): Promise<FeedInfo> {
          throw new Error('Should not be called');
        }
      }

      const customAdapters: ProtocolAdapter[] = [
        new NonHandlingAdapter1(),
        new NonHandlingAdapter2(),
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await detectPriceFeed(
          {
            publicClient,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_cbETH,
          },
          customAdapters
        );
        
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Failed to detect price feed');
        expect(error.message).to.include('Tried 2 adapters');
      }
    });

    it('should throw error with invalid protocol address', async function() {
      this.timeout(15000);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await detectPriceFeed({
          publicClient,
          protocolAddress: INVALID_PROTOCOL as any,
          assetAddress: BASE_cbETH,
        });
        
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Failed to detect price feed');
      }
    });
  });
});
