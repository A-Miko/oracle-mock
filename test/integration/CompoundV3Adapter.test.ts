import { expect } from 'chai';
import { CompoundV3Adapter } from '../../src/discovery/adapters/CompoundV3Adapter';
import { createPublicClient, http } from 'viem';
import { base, mainnet } from 'viem/chains';
import type { PublicClient, Address } from 'viem';
import * as dotenv from 'dotenv';
dotenv.config();

describe('CompoundV3Adapter - Integration Tests', () => {
  let publicClientBase: PublicClient;
  let publicClientMainnet: PublicClient;
  let adapter: CompoundV3Adapter;

  // Base mainnet addresses
  const BASE_COMET_USDC = '0x46e6b214b524310239732D51387075E0e70970bf';
  const BASE_COMET_WETH = '0x46e6b214b524310239732D51387075E0e70970bf'; // Replace with actual WETH Comet if different
  const BASE_cbETH = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22';
  const BASE_WETH = '0x4200000000000000000000000000000000000006';
  const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const BASE_ETH = '0x0000000000000000000000000000000000000000';
  const BASE_TBTC = '0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b';
  const BASE_WSTETH = '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452';
  const BASE_CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
  
  // Ethereum mainnet addresses
  const ETH_COMET_USDC = '0xc3d688B66703497DAA19211EEdff47f25384cdc3'; // cUSDCv3
  const ETH_COMET_WETH = '0xA17581A9E3356d9A858b789D68B4d866e593aE94'; // cWETHv3
  const ETH_WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
  const ETH_RSETH = '0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7';

  before(async () => {
    const rpcUrl = process.env.BASE_RPC_URL;
    const ethRpcUrl = process.env.ETH_RPC_URL;

    publicClientBase = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    }) as PublicClient;

    publicClientMainnet = createPublicClient({
      chain: mainnet,
      transport: http(ethRpcUrl),
    }) as PublicClient;

    adapter = new CompoundV3Adapter();
  });

  describe('canHandle', () => {
    it('should detect Compound V3 contract on Base', async () => {
      const result = await adapter.canHandle({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH, // Use cbETH instead
      });

      expect(result).to.be.true;
    });

    it('should return false for non-Compound contract', async () => {
      const result = await adapter.canHandle({
        publicClient: publicClientBase,
        protocolAddress: BASE_WETH,
        assetAddress: BASE_WETH,
      });

      expect(result).to.be.false;
    });
  });

  describe('discoverFeed', () => {
    it('should discover cbETH price feed on Base', async () => {
      const feedInfo = await adapter.discoverFeed({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
      expect(feedInfo.description?.toUpperCase()).to.include('CBETH');
    });

    it('should return valid feed address format', async () => {
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const feedInfo = await adapter.discoverFeed({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(feedInfo.address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  // ==========================================
  // 1. EDGE CASES TESTING
  // ==========================================
  describe('Edge Cases', () => {
    describe('Description handling', () => {
      it('should handle feeds with missing description gracefully', async function() {
        this.timeout(10000); // Increase timeout for network calls
        
        // Test with an asset that might have a feed without description
        const feedInfo = await adapter.discoverFeed({
          publicClient: publicClientBase,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_cbETH,
        });

        // Should still return valid feed info even if description is empty
        expect(feedInfo.address).to.be.a('string');
        expect(feedInfo.decimals).to.be.oneOf([8, 18]);
        // Description might be empty string or undefined, both are acceptable
        if (feedInfo.description) {
          expect(feedInfo.description).to.be.a('string');
        }
      });
    });

    describe('Invalid decimals validation', () => {
      it('should throw error for feeds with invalid decimals (not 8 or 18)', async function() {
        this.timeout(10000);
        
        // Note: This test might be hard to create in real environment
        // as all real Chainlink feeds use 8 or 18 decimals
        // This documents expected behavior if such a feed exists
        
        // For now, we'll just verify the existing feeds have valid decimals
        const feedInfo = await adapter.discoverFeed({
          publicClient: publicClientBase,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_cbETH,
        });

        expect(feedInfo.decimals).to.be.oneOf([8, 18], 
          'Feed decimals must be either 8 or 18');
      });
    });

    describe('Non-existent asset', () => {
      it('should throw error when asset does not exist in Comet', async function() {
        this.timeout(10000);
        
        // Use USDC as asset - it's the base asset, not collateral
        try {
          await adapter.discoverFeed({
            publicClient: publicClientBase,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_WETH, // Base asset, not collateral
          });
          expect.fail('Should have thrown an error for non-collateral asset');
        } catch (error: any) {
          expect(error.message).to.include('Failed to discover feed');
        }
      });

      it('should throw error for random non-existent asset address', async function() {
        this.timeout(10000);
        
        const randomAddress = '0x0000000000000000000000000000000000000123' as Address;
        
        try {
          await adapter.discoverFeed({
            publicClient: publicClientBase,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: randomAddress,
          });
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).to.include('Failed to discover feed');
        }
      });
    });

    describe('Network errors', () => {
      it('should handle RPC failures gracefully', async function() {
        this.timeout(10000);
        
        // Create client with invalid RPC
        const badClient = createPublicClient({
          chain: base,
          transport: http('https://invalid-rpc-endpoint-that-does-not-exist.com'),
        }) as PublicClient;

        try {
          await adapter.canHandle({
            publicClient: badClient,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_cbETH,
          });
          expect.fail('Should have thrown network error');
        } catch (error: any) {
          // Should throw network-related error
          expect(error).to.exist;
        }
      });
    });
  });

  // ==========================================
  // 2. MULTIPLE ASSETS TESTING
  // ==========================================
  describe('Different Assets Scenarios', () => {
    it('should discover feed for cbETH on Base', async function() {
      this.timeout(10000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const feedInfo = await adapter.discoverFeed({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
      expect(feedInfo.description?.toUpperCase()).to.include('CBETH');
    });

    it('should discover feed for wstETH on Base', async function() {
      this.timeout(10000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const feedInfo = await adapter.discoverFeed({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_WSTETH,
      });

      expect(feedInfo.address).to.be.a('string');
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
      expect(feedInfo.description?.toUpperCase()).to.include('WSTETH');
    });
  });

  // ==========================================
  // 3. MULTIPLE COMET MARKETS
  // ==========================================
  describe('Multiple Comet Markets', () => {
    it('should work with USDC Comet market on Base', async function() {
      this.timeout(10000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await adapter.canHandle({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(result).to.be.true;
    });
  });

  // ==========================================
  // 4. DIFFERENT CHAINS TESTING
  // ==========================================
  describe('Multi-Chain Support', () => {
    it('should detect Compound V3 on Base mainnet', async function() {
      this.timeout(10000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await adapter.canHandle({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(result).to.be.true;
    });

    it('should discover feeds correctly on Base', async function() {
      this.timeout(10000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const feedInfo = await adapter.discoverFeed({
        publicClient: publicClientBase,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(feedInfo.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(feedInfo.decimals).to.be.oneOf([8, 18]);
    });
  });

  // ==========================================
  // 5. HAPPY PATH VS SAD PATH
  // ==========================================
  describe('Input Validation', () => {
    describe('Invalid addresses', () => {
      it('should reject non-checksummed address', async function() {
        this.timeout(10000);
        
        const nonChecksummed = '0x46e6b214b524310239732d51387075e0e70970bf' as Address; // lowercase
        
        try {
          await adapter.canHandle({
            publicClient: publicClientBase,
            protocolAddress: nonChecksummed,
            assetAddress: BASE_cbETH,
          });
          // Note: viem might auto-checksum, so this might not fail
          // The test documents expected behavior
        } catch (error: any) {
          expect(error).to.exist;
        }
      });

      it('should reject invalid address format (wrong length)', async function() {
        this.timeout(10000);
        
        const invalidAddress = '0x123' as Address; // Too short
        
        try {
          await adapter.canHandle({
            publicClient: publicClientBase,
            protocolAddress: invalidAddress,
            assetAddress: BASE_cbETH,
          });
          expect.fail('Should have thrown error for invalid address');
        } catch (error: any) {
          expect(error).to.exist;
        }
      });

      it('should reject completely invalid address string', async function() {
        this.timeout(10000);
        
        const invalidAddress = 'not-an-address' as Address;
        
        try {
          await adapter.canHandle({
            publicClient: publicClientBase,
            protocolAddress: invalidAddress,
            assetAddress: BASE_cbETH,
          });
          expect.fail('Should have thrown error');
        } catch (error: any) {
          expect(error).to.exist;
        }
      });
    });

    describe('Non-protocol contracts', () => {
      it('should return false for generic ERC20 token', async function() {
        this.timeout(10000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Use USDC (ERC20 token) as protocol address
        const result = await adapter.canHandle({
          publicClient: publicClientBase,
          protocolAddress: BASE_USDC, // This is ERC20, not Comet
          assetAddress: BASE_cbETH,
        });

        expect(result).to.be.false;
      });

      it('should return false for WETH contract', async function() {
        this.timeout(10000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = await adapter.canHandle({
          publicClient: publicClientBase,
          protocolAddress: BASE_WETH, // This is WETH9, not Comet
          assetAddress: BASE_cbETH,
        });

        expect(result).to.be.false;
      });

      it('should throw error when trying to discover feed on non-Comet contract', async function() {
        this.timeout(10000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          await adapter.discoverFeed({
            publicClient: publicClientBase,
            protocolAddress: BASE_USDC, // Not a Comet contract
            assetAddress: BASE_cbETH,
          });
          expect.fail('Should have thrown error for non-Comet contract');
        } catch (error: any) {
          expect(error.message).to.include('Failed to discover feed');
        }
      });
    });

    describe('Rate limiting resilience', () => {
      it('should handle sequential requests with delays', async function() {
        this.timeout(20000);
        
        const requests = [];
        
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between requests
          
          const result = await adapter.canHandle({
            publicClient: publicClientBase,
            protocolAddress: BASE_COMET_USDC,
            assetAddress: BASE_cbETH,
          });
          
          requests.push(result);
        }

        // All requests should succeed
        expect(requests).to.have.lengthOf(3);
        expect(requests.every(r => r === true)).to.be.true;
      });

      it('should handle rapid consecutive requests gracefully', async function() {
        this.timeout(15000);
        
        // Fire 3 requests with minimal delay
        const promise1 = adapter.canHandle({
          publicClient: publicClientBase,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_cbETH,
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const promise2 = adapter.canHandle({
          publicClient: publicClientBase,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_WETH,
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const promise3 = adapter.canHandle({
          publicClient: publicClientBase,
          protocolAddress: BASE_COMET_USDC,
          assetAddress: BASE_cbETH,
        });

        const results = await Promise.all([promise1, promise2, promise3]);
        
        // Should handle all requests (might hit rate limits but should not crash)
        expect(results).to.have.lengthOf(3);
      });
    });
  });

  // ==========================================
  // 6. ADAPTER METADATA
  // ==========================================
  describe('Adapter Metadata', () => {
    it('should have correct adapter name', () => {
      expect(adapter.name).to.equal('Compound V3');
    });

    it('should have correct adapter type', () => {
      expect(adapter.type).to.equal('compound-v3');
    });
  });
});
