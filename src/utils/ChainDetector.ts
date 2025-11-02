import type { PublicClient } from 'viem';

export type RpcProvider = 'hardhat' | 'anvil';
export type SetCodeMethod = 'hardhat_setCode' | 'anvil_setCode';
export type MineMethod = 'hardhat_mine' | 'anvil_mine';

/**
 * Auto-detect whether running on Hardhat or Anvil/Foundry
 * 
 * @param publicClient - Viem public client
 * @returns Detected RPC provider type
 * 
 * @example
 * ```
 * const provider = await detectRpcProvider(publicClient);
 * if (provider === 'hardhat') {
 *   await client.request({ method: 'hardhat_setCode', params: [...] });
 * } else {
 *   await client.request({ method: 'anvil_setCode', params: [...] });
 * }
 * ```
 */
export async function detectRpcProvider(publicClient: PublicClient): Promise<RpcProvider> {
  try {
    // Try Hardhat-specific method
    await (publicClient as any).transport.request({
      method: 'hardhat_setCode',
    });
    return 'hardhat';
  } catch {
    // Assume Anvil/Foundry if Hardhat method fails
    return 'anvil';
  }
}

/**
 * Get correct setCode RPC method name for detected provider
 * 
 * @param publicClient - Viem public client
 * @returns Correct RPC method name
 */
export async function getSetCodeMethod(publicClient: PublicClient): Promise<SetCodeMethod> {
  const provider = await detectRpcProvider(publicClient);
  return provider === 'hardhat' ? 'hardhat_setCode' : 'anvil_setCode';
}

/**
 * Get correct mine RPC method name for detected provider
 * 
 * @param publicClient - Viem public client
 * @returns Correct mine method name
 */
export async function getMineMethod(publicClient: PublicClient): Promise<MineMethod> {
  const provider = await detectRpcProvider(publicClient);
  return provider === 'hardhat' ? 'hardhat_mine' : 'anvil_mine';
}

/**
 * Check if running on Hardhat
 */
export async function isHardhat(publicClient: PublicClient): Promise<boolean> {
  return (await detectRpcProvider(publicClient)) === 'hardhat';
}

/**
 * Check if running on Anvil/Foundry
 */
export async function isAnvil(publicClient: PublicClient): Promise<boolean> {
  return (await detectRpcProvider(publicClient)) === 'anvil';
}
