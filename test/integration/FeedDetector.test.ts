import { expect } from 'chai';
import { detectPriceFeed } from '../../src/discovery/FeedDetector';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import type { PublicClient } from 'viem';
import * as dotenv from 'dotenv';
dotenv.config();

describe('FeedDetector - Integration Tests', () => {
  let publicClient: PublicClient;

  const BASE_COMET_USDC = '0x46e6b214b524310239732D51387075E0e70970bf';
  const BASE_cbETH = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22'; // Use cbETH

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
});
