import type { Address, PublicClient } from 'viem';
import { getCurrentPrice, formatPrice } from '../mock/PriceSetter';

export interface PriceVerificationResult {
  success: boolean;
  feedAddress: Address;
  expectedPrice: bigint;
  actualPrice: bigint;
  match: boolean;
  message: string;
}

/**
 * Verify that a price feed reflects the expected price
 * 
 * @param feedAddress - Address of the Chainlink feed
 * @param expectedPrice - Expected price value
 * @param publicClient - Viem public client
 * @param decimals - Feed decimals for formatting logs
 * @returns Verification result with detailed comparison
 */
export async function verifyPriceChange(
  feedAddress: Address,
  expectedPrice: bigint,
  publicClient: PublicClient,
  decimals: 8 | 18 = 8
): Promise<PriceVerificationResult> {
  try {
    const actualPrice = await getCurrentPrice(feedAddress, publicClient);
    const match = actualPrice === expectedPrice;

    const message = match
      ? `✅ Price verified: ${formatPrice(actualPrice, decimals)}`
      : `❌ Price mismatch: expected ${formatPrice(expectedPrice, decimals)}, got ${formatPrice(actualPrice, decimals)}`;

    console.log(message);

    return {
      success: true,
      feedAddress,
      expectedPrice,
      actualPrice,
      match,
      message,
    };
  } catch (error: any) {
    const message = `❌ Failed to verify price at ${feedAddress}: ${error.message}`;
    console.error(message);

    return {
      success: false,
      feedAddress,
      expectedPrice,
      actualPrice: 0n,
      match: false,
      message,
    };
  }
}

/**
 * Verify price change with tolerance (for protocols that may have rounding)
 */
export async function verifyPriceChangeWithTolerance(
  feedAddress: Address,
  expectedPrice: bigint,
  publicClient: PublicClient,
  tolerancePercent: number = 0.01, // 0.01% default
  decimals: 8 | 18 = 8
): Promise<PriceVerificationResult> {
  try {
    const actualPrice = await getCurrentPrice(feedAddress, publicClient);
    
    const tolerance = (expectedPrice * BigInt(Math.floor(tolerancePercent * 100))) / 10000n;
    const lowerBound = expectedPrice - tolerance;
    const upperBound = expectedPrice + tolerance;
    
    const match = actualPrice >= lowerBound && actualPrice <= upperBound;

    const message = match
      ? `✅ Price within tolerance: ${formatPrice(actualPrice, decimals)}`
      : `❌ Price outside tolerance: expected ${formatPrice(expectedPrice, decimals)} ±${tolerancePercent}%, got ${formatPrice(actualPrice, decimals)}`;

    console.log(message);

    return {
      success: true,
      feedAddress,
      expectedPrice,
      actualPrice,
      match,
      message,
    };
  } catch (error: any) {
    const message = `❌ Failed to verify price: ${error.message}`;
    console.error(message);

    return {
      success: false,
      feedAddress,
      expectedPrice,
      actualPrice: 0n,
      match: false,
      message,
    };
  }
}
