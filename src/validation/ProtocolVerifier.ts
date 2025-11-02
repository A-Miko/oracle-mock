import type { Address, PublicClient } from 'viem';
import { parseAbi } from 'viem';
import { formatPrice } from '../mock/PriceSetter';

export interface ProtocolPriceResult {
  success: boolean;
  protocolAddress: Address;
  assetAddress: Address;
  priceFeed: Address;
  expectedPrice: bigint;
  actualPrice: bigint;
  match: boolean;
  message: string;
  protocol: string;
}

/**
 * Protocol-specific price reading strategies
 */
export const PROTOCOL_ADAPTERS = {
  'compound-v3': {
    name: 'Compound V3',
    getPrice: async (
      publicClient: PublicClient,
      protocolAddress: Address,
      assetAddress: Address
    ): Promise<bigint> => {
      const abi = parseAbi(['function getPrice(address) view returns (uint256)']);
      
      // First get the price feed address
      const assetInfoAbi = parseAbi([
        'function getAssetInfoByAddress(address) view returns (uint8, address, address, uint64, uint64, uint64, uint64, uint128)',
      ]);
      
      const assetInfo = await publicClient.readContract({
        address: protocolAddress,
        abi: assetInfoAbi,
        functionName: 'getAssetInfoByAddress',
        args: [assetAddress],
      });
      
      const priceFeed = assetInfo[2]; // 3rd element is priceFeed
      
      // Then get the price from Comet
      const price = await publicClient.readContract({
        address: protocolAddress,
        abi,
        functionName: 'getPrice',
        args: [priceFeed],
      });
      
      return BigInt(price);
    },
  },
  'morpho': {
    name: 'Morpho',
    getPrice: async (
      publicClient: PublicClient,
      protocolAddress: Address,
      assetAddress: Address
    ): Promise<bigint> => {
      const abi = parseAbi(['function price() view returns (uint256)']);
      const price = await publicClient.readContract({
        address: protocolAddress, // This would be the oracle address
        abi,
        functionName: 'price',
      });
      return BigInt(price);
    },
  },
  'aave-v3': {
    name: 'Aave V3',
    getPrice: async (
      publicClient: PublicClient,
      protocolAddress: Address,
      assetAddress: Address
    ): Promise<bigint> => {
      const abi = parseAbi(['function getAssetPrice(address) view returns (uint256)']);
      const price = await publicClient.readContract({
        address: protocolAddress, // Oracle address
        abi,
        functionName: 'getAssetPrice',
        args: [assetAddress],
      });
      return BigInt(price);
    },
  },
} as const;

export type SupportedProtocol = keyof typeof PROTOCOL_ADAPTERS;

/**
 * Verify that a protocol sees the expected price for an asset
 * 
 * @param protocolAddress - Address of protocol contract (Comet, Oracle, etc.)
 * @param assetAddress - Address of the asset
 * @param expectedPrice - Expected price the protocol should see
 * @param publicClient - Viem public client
 * @param protocolType - Type of protocol (compound-v3, morpho, aave-v3)
 * @param decimals - Decimals for formatting
 * @returns Verification result with protocol-specific details
 */
export async function verifyProtocolSeesPrice(
  protocolAddress: Address,
  assetAddress: Address,
  expectedPrice: bigint,
  publicClient: PublicClient,
  protocolType: SupportedProtocol,
  decimals: 8 | 18 = 8
): Promise<ProtocolPriceResult> {
  const adapter = PROTOCOL_ADAPTERS[protocolType];
  
  if (!adapter) {
    throw new Error(`Unsupported protocol: ${protocolType}`);
  }

  try {
    console.log(`🔍 Verifying ${adapter.name} sees expected price...`);
    
    const actualPrice = await adapter.getPrice(publicClient, protocolAddress, assetAddress);
    const match = actualPrice === expectedPrice;

    const message = match
      ? `✅ ${adapter.name} sees correct price: ${formatPrice(actualPrice, decimals)}`
      : `❌ ${adapter.name} price mismatch: expected ${formatPrice(expectedPrice, decimals)}, got ${formatPrice(actualPrice, decimals)}`;

    console.log(message);

    return {
      success: true,
      protocolAddress,
      assetAddress,
      priceFeed: protocolAddress, // Simplified - could extract actual feed
      expectedPrice,
      actualPrice,
      match,
      message,
      protocol: adapter.name,
    };
  } catch (error: any) {
    const message = `❌ Failed to verify ${adapter.name} price: ${error.message}`;
    console.error(message);

    return {
      success: false,
      protocolAddress,
      assetAddress,
      priceFeed: protocolAddress,
      expectedPrice,
      actualPrice: 0n,
      match: false,
      message,
      protocol: adapter.name,
    };
  }
}

/**
 * Verify protocol price with tolerance
 */
export async function verifyProtocolPriceWithTolerance(
  protocolAddress: Address,
  assetAddress: Address,
  expectedPrice: bigint,
  publicClient: PublicClient,
  protocolType: SupportedProtocol,
  tolerancePercent: number = 0.01,
  decimals: 8 | 18 = 8
): Promise<ProtocolPriceResult> {
  const adapter = PROTOCOL_ADAPTERS[protocolType];
  
  try {
    const actualPrice = await adapter.getPrice(publicClient, protocolAddress, assetAddress);
    
    const tolerance = (expectedPrice * BigInt(Math.floor(tolerancePercent * 100))) / 10000n;
    const lowerBound = expectedPrice - tolerance;
    const upperBound = expectedPrice + tolerance;
    
    const match = actualPrice >= lowerBound && actualPrice <= upperBound;

    const message = match
      ? `✅ ${adapter.name} price within tolerance: ${formatPrice(actualPrice, decimals)}`
      : `❌ ${adapter.name} price outside tolerance: expected ${formatPrice(expectedPrice, decimals)} ±${tolerancePercent}%, got ${formatPrice(actualPrice, decimals)}`;

    console.log(message);

    return {
      success: true,
      protocolAddress,
      assetAddress,
      priceFeed: protocolAddress,
      expectedPrice,
      actualPrice,
      match,
      message,
      protocol: adapter.name,
    };
  } catch (error: any) {
    return {
      success: false,
      protocolAddress,
      assetAddress,
      priceFeed: protocolAddress,
      expectedPrice,
      actualPrice: 0n,
      match: false,
      message: `❌ Failed: ${error.message}`,
      protocol: adapter.name,
    };
  }
}
