import type { Address, PublicClient, WalletClient } from 'viem';
import { parseAbi } from 'viem';
import type { SetPriceOptions, PriceChangeOptions, PriceChangeResult } from './types';
import { formatPrice, parsePrice } from '../utils/DecimalConverter';

/**
 * Mock Feed Write ABI - uses setLatestAnswer() function
 */
const MOCK_WRITE_ABI = parseAbi([
  'function setLatestAnswer(int256) external',
]);

/**
 * Chainlink AggregatorV3Interface ABI for reading
 */
const AGGREGATOR_READ_ABI = parseAbi([
  'function latestAnswer() view returns (int256)',
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

/**
 * Set absolute price on a mock feed
 * 
 * @param options - Price setting options
 * @returns Transaction result with old and new prices
 */
export async function setPrice(
  options: SetPriceOptions
): Promise<PriceChangeResult> {
  const { feedAddress, publicClient, walletClient, account, newPrice, decimals } = options;

  const oldPrice = await getCurrentPrice(feedAddress, publicClient);

  console.log(
    `💰 Setting price at ${feedAddress}: ${formatPrice(oldPrice, decimals)} → ${formatPrice(newPrice, decimals)}`
  );

  try {
    const hash = await walletClient.writeContract({
      account,
      address: feedAddress,
      abi: MOCK_WRITE_ABI,
      functionName: 'setLatestAnswer',
      args: [newPrice],
    } as any);

    console.log(`📝 Transaction sent: ${hash}`);

    // CRITICAL: Wait for receipt before reading
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    await verifyPrice({ feedAddress, publicClient, expectedPrice: newPrice });

    return {
      success: true,
      oldPrice,
      newPrice,
      transactionHash: hash,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to set price at ${feedAddress}: ${error.message}`
    );
  }
}

/**
 * Set price with percentage change (simple, single direction)
 */
export async function setPriceWithPercentageChange(
  options: PriceChangeOptions
): Promise<PriceChangeResult> {
  const { feedAddress, publicClient, walletClient, account, percentageChange, decimals } = options;

  const currentPrice = await getCurrentPrice(feedAddress, publicClient);

  if (currentPrice === 0n) {
    throw new Error(
      `Cannot apply percentage change: current price is 0 at ${feedAddress}`
    );
  }

  const multiplier = 100 + percentageChange;
  const newPrice = (currentPrice * BigInt(multiplier)) / 100n;

  console.log(
    `📊 Applying ${percentageChange > 0 ? '+' : ''}${percentageChange}% change`
  );

  return await setPrice({
    feedAddress,
    publicClient,
    walletClient,
    account,
    newPrice,
    decimals,
  });
}

/**
 * NEW: Set price with bi-directional testing for composite oracles
 * 
 * This function tries applying the factor in both directions to handle cases
 * where the feed could be either the numerator or denominator in the oracle formula.
 * 
 * @param options - Price change options
 * @param oracleValidator - Optional function to validate if oracle price changed as expected
 * @returns Transaction result with old and new prices
 * 
 * @example
 * ```
 * // For Morpho or other composite oracles
 * await setPriceWithBidirectionalFactor({
 *   feedAddress: '0x1234...',
 *   publicClient,
 *   walletClient,
 *   account,
 *   percentageChange: -10, // Try to decrease by 10%
 *   decimals: 8,
 * }, async () => {
 *   // Check if Morpho oracle price decreased
 *   const oraclePrice = await publicClient.readContract({
 *     address: MORPHO_ORACLE,
 *     abi: parseAbi(['function price() view returns (uint256)']),
 *     functionName: 'price',
 *   });
 *   return oraclePrice;
 * });
 * ```
 */
export async function setPriceWithBidirectionalFactor(
  options: PriceChangeOptions,
  oracleValidator?: () => Promise<bigint>
): Promise<PriceChangeResult & { direction: 'forward' | 'inverse' | 'unknown' }> {
  const { feedAddress, publicClient, walletClient, account, percentageChange, decimals } = options;

  const currentPrice = await getCurrentPrice(feedAddress, publicClient);

  if (currentPrice === 0n) {
    throw new Error(
      `Cannot apply percentage change: current price is 0 at ${feedAddress}`
    );
  }

  const scale = 10n ** BigInt(decimals);
  const multiplier = 100 + percentageChange;
  const factor = (scale * BigInt(multiplier)) / 100n;

  console.log(`🔄 Trying bi-directional factor application...`);

  // Get baseline oracle price if validator provided
  const oraclePriceBefore = oracleValidator ? await oracleValidator() : undefined;

  // Direction A: Apply factor directly (e.g., 0.90×)
  const candidateA = (currentPrice * factor) / scale;
  
  console.log(`⚡ Trying direction A: ${formatPrice(currentPrice, decimals)} → ${formatPrice(candidateA, decimals)}`);
  
  let hash = await walletClient.writeContract({
    account,
    address: feedAddress,
    abi: MOCK_WRITE_ABI,
    functionName: 'setLatestAnswer',
    args: [candidateA],
  } as any);
  
  await publicClient.waitForTransactionReceipt({ hash });
  
  const oraclePriceA = oracleValidator ? await oracleValidator() : undefined;
  
  if (oraclePriceA && oraclePriceBefore && oraclePriceA < oraclePriceBefore) {
    console.log(`✅ Direction A succeeded: Oracle price decreased`);
    return {
      success: true,
      oldPrice: currentPrice,
      newPrice: candidateA,
      transactionHash: hash,
      direction: 'forward',
    };
  }

  // Direction B: Revert and try inverse (1/factor)
  console.log(`🔄 Direction A didn't work, trying inverse...`);
  
  // Restore original price first
  hash = await walletClient.writeContract({
    account,
    address: feedAddress,
    abi: MOCK_WRITE_ABI,
    functionName: 'setLatestAnswer',
    args: [currentPrice],
  } as any);
  
  await publicClient.waitForTransactionReceipt({ hash });
  
  // Apply inverse factor
  const candidateB = (currentPrice * scale) / factor;
  
  console.log(`⚡ Trying direction B (inverse): ${formatPrice(currentPrice, decimals)} → ${formatPrice(candidateB, decimals)}`);
  
  hash = await walletClient.writeContract({
    account,
    address: feedAddress,
    abi: MOCK_WRITE_ABI,
    functionName: 'setLatestAnswer',
    args: [candidateB],
  } as any);
  
  await publicClient.waitForTransactionReceipt({ hash });
  
  const oraclePriceB = oracleValidator ? await oracleValidator() : undefined;
  
  if (oraclePriceB && oraclePriceBefore && oraclePriceB < oraclePriceBefore) {
    console.log(`✅ Direction B (inverse) succeeded: Oracle price decreased`);
    return {
      success: true,
      oldPrice: currentPrice,
      newPrice: candidateB,
      transactionHash: hash,
      direction: 'inverse',
    };
  }

  // Neither worked - restore original and report
  console.warn(`⚠️  Neither direction affected oracle price as expected`);
  
  hash = await walletClient.writeContract({
    account,
    address: feedAddress,
    abi: MOCK_WRITE_ABI,
    functionName: 'setLatestAnswer',
    args: [currentPrice],
  } as any);
  
  await publicClient.waitForTransactionReceipt({ hash });

  // If no validator provided, just use the last attempted price
  if (!oracleValidator) {
    console.log(`ℹ️  No oracle validator provided, using direction A by default`);
    hash = await walletClient.writeContract({
      account,
      address: feedAddress,
      abi: MOCK_WRITE_ABI,
      functionName: 'setLatestAnswer',
      args: [candidateA],
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });
    
    return {
      success: true,
      oldPrice: currentPrice,
      newPrice: candidateA,
      transactionHash: hash,
      direction: 'unknown',
    };
  }

  return {
    success: false,
    oldPrice: currentPrice,
    newPrice: currentPrice,
    transactionHash: hash,
    direction: 'unknown',
  };
}

/**
 * Get current price from feed
 */
export async function getCurrentPrice(
  feedAddress: Address,
  publicClient: PublicClient
): Promise<bigint> {
  try {
    const [, answer] = await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_READ_ABI,
      functionName: 'latestRoundData',
    });
    return BigInt(answer);
  } catch {
    try {
      const answer = await publicClient.readContract({
        address: feedAddress,
        abi: AGGREGATOR_READ_ABI,
        functionName: 'latestAnswer',
      });
      return BigInt(answer);
    } catch (error: any) {
      throw new Error(
        `Failed to get current price from ${feedAddress}: ${error.message}`
      );
    }
  }
}

/**
 * Verify that price was set correctly
 */
async function verifyPrice(options: {
  feedAddress: Address;
  publicClient: PublicClient;
  expectedPrice: bigint;
}): Promise<void> {
  const { feedAddress, publicClient, expectedPrice } = options;

  try {
    const actualPrice = await getCurrentPrice(feedAddress, publicClient);

    if (actualPrice !== expectedPrice) {
      throw new Error(
        `Price verification failed: expected ${expectedPrice}, got ${actualPrice}`
      );
    }

    console.log(`✅ Price verified: ${actualPrice}`);
  } catch (error: any) {
    throw new Error(
      `Price verification failed at ${feedAddress}: ${error.message}`
    );
  }
}

/**
 * Reset price to zero
 */
export async function resetPrice(
  feedAddress: Address,
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address,
  decimals: 8 | 18
): Promise<PriceChangeResult> {
  console.log(`🔄 Resetting price at ${feedAddress} to 0`);

  return await setPrice({
    feedAddress,
    publicClient,
    walletClient,
    account,
    newPrice: 0n,
    decimals,
  });
}
/**
 * Get decimals from feed
 */
export async function getDecimals(
  feedAddress: Address,
  publicClient: PublicClient
): Promise<number> {
  try {
    const decimals = await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_READ_ABI,
      functionName: 'decimals',
    });
    return decimals;
  } catch (error: any) {
    throw new Error(
      `Failed to get decimals from ${feedAddress}: ${error.message}`
    );
  }
}
