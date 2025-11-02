/**
 * Format price for display
 * (This is what parseOraclePrice does - just renamed for consistency)
 */
export function formatPrice(price: bigint, decimals: 8 | 18): string {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = price / divisor;
  const fractionalPart = price % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return `${wholePart}.${fractionalStr}`;
}

/**
 * Parse human-readable price to oracle format
 * (This is what convertToOracleDecimals does - just renamed)
 */
export function parsePrice(priceStr: string, decimals: 8 | 18): bigint {
  const [whole, fractional = ''] = priceStr.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  const combinedStr = whole + paddedFractional;
  return BigInt(combinedStr);
}
