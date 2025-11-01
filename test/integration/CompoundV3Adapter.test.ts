import { expect } from 'chai';
import { CompoundV3Adapter } from '../../src/discovery/adapters/CompoundV3Adapter';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import type { PublicClient } from 'viem';
import * as dotenv from 'dotenv';
dotenv.config();

describe('CompoundV3Adapter - Integration Tests', () => {
  let publicClient: PublicClient;
  let adapter: CompoundV3Adapter;

  // Real Base mainnet addresses
  const BASE_COMET_USDC = '0x46e6b214b524310239732D51387075E0e70970bf';
  const BASE_WETH = '0x4200000000000000000000000000000000000006';
  const BASE_cbETH = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22';
  
  // IMPORTANT: WETH might not be a collateral asset in this Comet
  // Let's test with cbETH which is more likely to be collateral

  before(async () => {
    publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL),
    }) as PublicClient;

    adapter = new CompoundV3Adapter();
  });

  describe('canHandle', () => {
    it('should detect Compound V3 contract on Base', async () => {
      const result = await adapter.canHandle({
        publicClient,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH, // Use cbETH instead
      });

      expect(result).to.be.true;
    });

    it('should return false for non-Compound contract', async () => {
      const result = await adapter.canHandle({
        publicClient,
        protocolAddress: BASE_WETH,
        assetAddress: BASE_WETH,
      });

      expect(result).to.be.false;
    });
  });

  describe('discoverFeed', () => {
    it('should discover cbETH price feed on Base', async () => {
      const feedInfo = await adapter.discoverFeed({
        publicClient,
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
        publicClient,
        protocolAddress: BASE_COMET_USDC,
        assetAddress: BASE_cbETH,
      });

      expect(feedInfo.address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});
