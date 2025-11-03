import type { Address } from 'viem';
import { createClients, type SupportedNetwork } from '../client/ClientFactory';
import { detectPriceFeed } from '../discovery/FeedDetector';
import { deployMockAtAddress } from '../mock/MockDeployer';
import { setPrice, setPriceWithPercentageChange, getCurrentPrice } from '../mock/PriceSetter';
import { verifyPriceChange } from '../validation/PriceVerifier';
import { SupportedProtocol, verifyProtocolSeesPrice } from '../validation/ProtocolVerifier';
import { parsePrice, formatPrice } from '../utils/DecimalConverter';
import type {
  SetOraclePriceOptions,
  SetOraclePriceResult,
  ResetOraclePriceOptions,
  DiscoverFeedsOptions,
  DeployMockFeedOptions,
  VerifyPriceOptions,
  ProtocolType,
} from './types';
import type { FeedInfo } from '../discovery/types';

// Store original prices for reset functionality
const originalPrices = new Map<string, bigint>();

/**
 * Simple API: Set oracle price for a DeFi protocol
 * 
 * This is the main function users will call to manipulate oracle prices.
 * It handles:
 * 1. Feed discovery
 * 2. Mock deployment
 * 3. Price setting
 * 4. Verification
 * 
 * @param options - Configuration options
 * @returns Result with price change details
 * 
 * @example
 * ```
 * // Crash WETH price by 50%
 * await setOraclePrice({
 *   rpcUrl: 'http://127.0.0.1:8545',
 *   protocol: 'compound-v3',
 *   network: 'base',
 *   protocolAddress: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
 *   assetAddress: '0x4200000000000000000000000000000000000006', // WETH
 *   priceChangePercent: -50,
 * });
 * 
 * // Set absolute price
 * await setOraclePrice({
 *   rpcUrl: 'http://127.0.0.1:8545',
 *   protocol: 'compound-v3',
 *   network: 'base',
 *   protocolAddress: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
 *   assetAddress: '0x4200000000000000000000000000000000000006',
 *   newPrice: '1500', // $1500
 * });
 * ```
 */
export async function setOraclePrice(
  options: SetOraclePriceOptions
): Promise<SetOraclePriceResult> {
  const {
    rpcUrl,
    protocol,
    network,
    protocolAddress,
    assetAddress,
    newPrice,
    priceChangePercent,
    privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil default
    decimals,
  } = options;

  try {
    console.log(`\n🎯 Setting oracle price for ${protocol} on ${network}`);
    console.log(`   Protocol: ${protocolAddress}`);
    console.log(`   Asset: ${assetAddress}`);

    // Step 1: Create clients
    const { publicClient, walletClient } = createClients({
      rpcUrl,
      network,
      privateKey,
    });

    // Step 2: Discover price feed
    console.log('\n🔍 Step 1: Discovering price feed...');
    const feedInfo: FeedInfo = await detectPriceFeed({
      publicClient,
      protocolAddress,
      assetAddress,
    });

    console.log(`   ✅ Found feed: ${feedInfo.address}`);
    console.log(`   Decimals: ${feedInfo.decimals}`);
    console.log(`   Description: ${feedInfo.description || 'N/A'}`);

    const feedDecimals = decimals || feedInfo.decimals;

    // Step 3: Get ORIGINAL price BEFORE deploying mock
    console.log('\n📊 Step 2: Reading original price from live feed...');
    let originalPrice: bigint;
    try {
      originalPrice = await getCurrentPrice(feedInfo.address, publicClient);
      
      // 🔥 ADD SANITY CHECK HERE!
      const MAX_REASONABLE_PRICE = 1_000_000_00000000n; // $1M with 8 decimals
      if (originalPrice > MAX_REASONABLE_PRICE || originalPrice === 0n) {
        console.log(`   ⚠️  Price looks corrupted (${formatPrice(originalPrice, feedDecimals)}), using default`);
        originalPrice = feedDecimals === 8 ? 250000000000n : 2500000000000000000000n; // $2500
      } else {
        console.log(`   Original price: ${formatPrice(originalPrice, feedDecimals)}`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not read original price, using default`);
      originalPrice = feedDecimals === 8 ? 250000000000n : 2500000000000000000000n; // $2500
    }

    // Store original price for reset functionality BEFORE any manipulation ✅ FIXED!
    const cacheKey = `${network}:${protocolAddress}:${assetAddress}`;
    if (!originalPrices.has(cacheKey)) {
      originalPrices.set(cacheKey, originalPrice);
      console.log(`   💾 Stored original price for reset functionality`);
    }

    // Step 4: Deploy mock feed ✅ FIXED ORDER!
    console.log('\n🛠️  Step 3: Deploying mock feed...');
    await deployMockAtAddress({
      feedAddress: feedInfo.address,
      decimals: feedDecimals,
      publicClient,
    });
    console.log(`   ✅ Mock deployed at ${feedInfo.address}`);

    // Step 5: Set the original price on the mock first ✅ NEW!
    console.log('\n🔄 Step 4: Initializing mock with original price...');
    await setPrice({
      feedAddress: feedInfo.address,
      publicClient,
      walletClient,
      account: walletClient.account!.address,
      newPrice: originalPrice,
      decimals: feedDecimals,
    });
    console.log(`   ✅ Mock initialized with original price`);

    // Step 6: Calculate and set new price ✅ UPDATED STEP NUMBER
    let finalPrice: bigint;

    if (priceChangePercent !== undefined) {
      console.log(`\n💰 Step 5: Changing price by ${priceChangePercent}%...`);
      const result = await setPriceWithPercentageChange({
        feedAddress: feedInfo.address,
        publicClient,
        walletClient,
        account: walletClient.account!.address,
        percentageChange: priceChangePercent,
        decimals: feedDecimals,
      });
      finalPrice = result.newPrice;
    } else if (newPrice !== undefined) {
      console.log(`\n💰 Step 5: Setting absolute price...`);
      const parsedPrice = typeof newPrice === 'string' 
        ? parsePrice(newPrice, feedDecimals) 
        : newPrice;
      
      const result = await setPrice({
        feedAddress: feedInfo.address,
        publicClient,
        walletClient,
        account: walletClient.account!.address,
        newPrice: parsedPrice,
        decimals: feedDecimals,
      });
      finalPrice = result.newPrice;
    } else {
      throw new Error('Either newPrice or priceChangePercent must be provided');
    }

    console.log(`   ✅ New price: ${formatPrice(finalPrice, feedDecimals)}`);

    // Step 7: Verify price at feed level ✅ UPDATED STEP NUMBER
    console.log('\n✅ Step 6: Verifying feed price...');
    const feedVerification = await verifyPriceChange(
      feedInfo.address,
      finalPrice,
      publicClient,
      feedDecimals
    );

    if (!feedVerification.match) {
      throw new Error(`Feed verification failed: ${feedVerification.message}`);
    }

    // Step 8: Verify protocol sees the price ✅ UPDATED STEP NUMBER
    console.log('\n🔬 Step 7: Verifying protocol sees new price...');
    const protocolVerification = await verifyProtocolSeesPrice(
      protocolAddress,
      assetAddress,
      finalPrice,
      publicClient,
      protocol as SupportedProtocol,
      feedDecimals
    );

    if (!protocolVerification.match) {
      console.warn(`   ⚠️  Protocol verification issue: ${protocolVerification.message}`);
    } else {
      console.log(`   ✅ Protocol sees correct price!`);
    }

    // Calculate price change percentage using ORIGINAL price ✅ FIXED!
    const priceChange = Number(((finalPrice - originalPrice) * 10000n) / originalPrice) / 100;

    console.log('\n🎉 Success! Oracle price manipulated.');
    console.log(`   Old: ${formatPrice(originalPrice, feedDecimals)}`);
    console.log(`   New: ${formatPrice(finalPrice, feedDecimals)}`);
    console.log(`   Change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);

    return {
      success: true,
      feedAddress: feedInfo.address,
      oldPrice: originalPrice, // ✅ Use stored original, not corrupted value
      newPrice: finalPrice,
      priceChangePercent: priceChange,
      verified: protocolVerification.match,
      message: `Price changed from ${formatPrice(originalPrice, feedDecimals)} to ${formatPrice(finalPrice, feedDecimals)} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)`,
    };
  } catch (error: any) {
    console.error(`\n❌ Failed to set oracle price: ${error.message}`);
    throw error;
  }
}

/**
 * Simple API: Reset oracle price to original value
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```
 * await resetOraclePrice({
 *   rpcUrl: 'http://127.0.0.1:8545',
 *   protocol: 'compound-v3',
 *   network: 'base',
 *   protocolAddress: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
 *   assetAddress: '0x4200000000000000000000000000000000000006',
 * });
 * ```
 */
export async function resetOraclePrice(
  options: ResetOraclePriceOptions
): Promise<void> {
  const { network, protocolAddress, assetAddress } = options;
  const cacheKey = `${network}:${protocolAddress}:${assetAddress}`;
  
  const originalPrice = originalPrices.get(cacheKey);
  
  if (!originalPrice) {
    throw new Error('No original price found. Set price first before resetting.');
  }

  await setOraclePrice({
    ...options,
    newPrice: originalPrice,
  });
}

/**
 * Advanced API: Discover price feeds for a protocol/asset
 */
export async function discoverFeeds(
  options: DiscoverFeedsOptions
): Promise<FeedInfo> {
  const { rpcUrl, network, protocolAddress, assetAddress, protocol } = options;
  
  const { publicClient } = createClients({ rpcUrl, network });
  
  return await detectPriceFeed({
    publicClient,
    protocolAddress,
    assetAddress,
  });
}

/**
 * Advanced API: Deploy mock feed at specific address
 */
export async function deployMockFeed(
  options: DeployMockFeedOptions
): Promise<{ address: Address; decimals: number }> {
  const { rpcUrl, network, feedAddress, decimals, initialPrice } = options;
  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const { publicClient, walletClient } = createClients({ rpcUrl, network, privateKey });
  
  await deployMockAtAddress({
    feedAddress,
    decimals,
    publicClient,
  });
  
  if (initialPrice) {
    await setPrice({
      feedAddress,
      publicClient,
      walletClient,
      account: walletClient.account!.address,
      newPrice: initialPrice,
      decimals,
    });
  }

  return {
    address: feedAddress,
    decimals,
  };
}

/**
 * Advanced API: Verify price at a feed
 */
export async function verifyPrice(
  options: VerifyPriceOptions
): Promise<boolean> {
  const { rpcUrl, network, feedAddress, expectedPrice, decimals = 8 } = options;
  
  const { publicClient } = createClients({ rpcUrl, network });
  
  const result = await verifyPriceChange(
    feedAddress,
    expectedPrice,
    publicClient,
    decimals
  );
  
  return result.match;
}
