import type { Address, PublicClient, Hex } from 'viem';
import { keccak256, encodePacked, pad, toHex } from 'viem';
import { getSetCodeMethod } from './ChainDetector';

/**
 * Calculate Solidity storage slot for mapping[key]
 * 
 * Formula: keccak256(abi.encodePacked(key, mapSlot))
 * 
 * @param key - Mapping key (address, uint256, etc.)
 * @param mapSlot - Base storage slot of the mapping
 * @returns Calculated storage slot
 * 
 * @example
 * ```
 * // For: mapping(address => uint256) public balances; // slot 0
 * const slot = calculateStorageSlot(
 *   '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   0
 * );
 * ```
 */
export function calculateStorageSlot(key: Address | bigint, mapSlot: number | bigint): Hex {
  let keyHex: Hex;
  
  if (typeof key === 'string') {
    // Address key - pad to 32 bytes
    keyHex = pad(key as Hex, { size: 32 });
  } else {
    // BigInt key - convert to hex and pad
    keyHex = pad(toHex(key), { size: 32 });
  }
  
  const slotHex = pad(toHex(BigInt(mapSlot)), { size: 32 });
  
  // keccak256(key + slot)
  return keccak256(encodePacked(['bytes32', 'bytes32'], [keyHex, slotHex]));
}

/**
 * Set storage directly at a specific slot
 * 
 * @param address - Contract address
 * @param slot - Storage slot (hex or number)
 * @param value - Value to set (hex or bigint)
 * @param publicClient - Viem public client
 * 
 * @example
 * ```
 * // Set balance of user in ERC20 contract
 * const balanceSlot = calculateStorageSlot(userAddress, 0);
 * await setStorageAt(
 *   tokenAddress,
 *   balanceSlot,
 *   parseUnits('1000', 18),
 *   publicClient
 * );
 * ```
 */
export async function setStorageAt(
  address: Address,
  slot: Hex | number | bigint,
  value: Hex | bigint,
  publicClient: PublicClient
): Promise<void> {
  const setCodeMethod = await getSetCodeMethod(publicClient);
  const provider = setCodeMethod.startsWith('hardhat') ? 'hardhat' : 'anvil';
  
  const slotHex = typeof slot === 'string' ? slot : pad(toHex(BigInt(slot)), { size: 32 });
  const valueHex = typeof value === 'string' ? value : pad(toHex(value), { size: 32 });
  
  const method = provider === 'hardhat' ? 'hardhat_setStorageAt' : 'anvil_setStorageAt';
  
  try {
    await publicClient.request({
      method: method as any,
      params: [address, slotHex, valueHex],
    });
    
    console.log(`✅ Storage set at ${address}, slot ${slotHex}`);
  } catch (error: any) {
    throw new Error(`Failed to set storage: ${error.message}`);
  }
}

/**
 * Get storage value at a specific slot
 * 
 * @param address - Contract address
 * @param slot - Storage slot
 * @param publicClient - Viem public client
 * @returns Storage value as hex
 */
export async function getStorageAt(
  address: Address,
  slot: Hex | number | bigint,
  publicClient: PublicClient
): Promise<Hex> {
  const slotHex = typeof slot === 'string' ? slot : pad(toHex(BigInt(slot)), { size: 32 });
  
  return await publicClient.getStorageAt({
    address,
    slot: slotHex,
  }) as Hex;
}
