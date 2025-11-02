import type { Address, PublicClient, Hex } from 'viem';
import { parseAbi } from 'viem';
import type { MockFeedHandle, DeployMockOptions } from './types';
import { getMockBytecode } from '../artifacts/ArtifactLoader';
import { getCurrentPrice } from './PriceSetter';

/**
 * Chainlink AggregatorV3Interface ABI (minimal)
 */
const AGGREGATOR_V3_ABI = parseAbi([
  'function latestAnswer() view returns (int256)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
  'function version() view returns (uint256)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

/**
 * Detect whether we're using Hardhat or Anvil/Foundry
 * 
 * @param publicClient - Viem public client
 * @returns 'hardhat' or 'anvil'
 */
async function detectRpcProvider(publicClient: PublicClient): Promise<'hardhat' | 'anvil'> {
  try {
    // Try Hardhat-specific method
    // Cast to any because hardhat_getAutomine is not a standard RPC method
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
 * Deploy mock feed bytecode at a specific address using setCode
 * 
 * This replaces the bytecode at the target address with a mock Chainlink feed
 * that can be controlled via setLatestAnswer() calls.
 * 
 * @param options - Deployment options
 * @returns MockFeedHandle for further operations
 * 
 * @throws Error if deployment fails or validation fails
 * 
 * @example
 * ```
 * const mockFeed = await deployMockAtAddress({
 *   feedAddress: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
 *   decimals: 8,
 *   publicClient,
 * });
 * 
 * console.log(`Mock deployed at ${mockFeed.address}`);
 * ```
 */
export async function deployMockAtAddress(
  options: DeployMockOptions
): Promise<MockFeedHandle> {
  const { feedAddress, decimals, publicClient } = options;

  // Validate decimals
  if (decimals !== 8 && decimals !== 18) {
    throw new Error(`Invalid decimals: ${decimals}. Must be 8 or 18`);
  }

  // Get the correct mock bytecode
  const mockBytecode = getMockBytecode(decimals);

  // Detect RPC provider (Hardhat or Anvil)
  const provider = await detectRpcProvider(publicClient);
  const setCodeMethod = provider === 'hardhat' ? 'hardhat_setCode' : 'anvil_setCode';

  console.log(`📝 Deploying ${decimals}-decimal mock at ${feedAddress} using ${provider}...`);

  try {
    // Deploy mock bytecode at the feed address using setCode
    await publicClient.request({
      method: setCodeMethod as any,
      params: [feedAddress, mockBytecode as Hex],
    });

    console.log(`✅ Mock bytecode deployed at ${feedAddress}`);

    // Validate deployment by calling contract methods
    await validateDeployment({ feedAddress, decimals, publicClient });

    return {
      address: feedAddress,
      decimals,
      publicClient,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to deploy mock at ${feedAddress}: ${error.message}`
    );
  }
}

/**
 * Validate that the mock feed was deployed correctly
 * 
 * @param options - Validation options
 * @throws Error if validation fails
 */
async function validateDeployment(options: {
  feedAddress: Address;
  decimals: 8 | 18;
  publicClient: PublicClient;
}): Promise<void> {
  const { feedAddress, decimals, publicClient } = options;

  try {
    // 1. Check decimals()
    const deployedDecimals = await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: 'decimals',
    });

    if (deployedDecimals !== decimals) {
      throw new Error(
        `Decimals mismatch: expected ${decimals}, got ${deployedDecimals}`
      );
    }

    // 2. Check latestAnswer() is callable (should return 0 initially)
    const answer = await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: 'latestAnswer',
    });

    console.log(`✅ Validation passed: decimals=${deployedDecimals}, initial answer=${answer}`);
  } catch (error: any) {
    throw new Error(
      `Mock validation failed at ${feedAddress}: ${error.message}`
    );
  }
}

/**
 * Check if address already has mock bytecode deployed
 * 
 * @param feedAddress - Address to check
 * @param publicClient - Viem public client
 * @returns true if mock is already deployed and functional
 * 
 * @example
 * ```
 * const isDeployed = await isMockDeployed('0x1234...', publicClient);
 * if (!isDeployed) {
 *   await deployMockAtAddress({ feedAddress, decimals: 8, publicClient });
 * }
 * ```
 */
export async function isMockDeployed(
  feedAddress: Address,
  publicClient: PublicClient
): Promise<boolean> {
  try {
    // Try to call decimals() - if it works, mock is likely deployed
    await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: 'decimals',
    });

    // Try to call latestAnswer() - mock should respond
    await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: 'latestAnswer',
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Get current mock feed information
 * 
 * @param feedAddress - Mock feed address
 * @param publicClient - Viem public client
 * @returns Current feed information
 * 
 * @example
 * ```
 * const info = await getMockFeedInfo('0x1234...', publicClient);
 * console.log(`Current price: ${info.currentPrice}, decimals: ${info.decimals}`);
 * ```
 */
export async function getMockFeedInfo(
  feedAddress: Address,
  publicClient: PublicClient
): Promise<{
  decimals: number;
  currentPrice: bigint;
  description?: string;
  version?: bigint;
}> {
  try {
    const decimals = await publicClient.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: 'decimals',
    });

    const currentPrice = await getCurrentPrice(feedAddress, publicClient);

    // Try to get optional metadata (may not exist in mock contracts)
    let description: string | undefined;
    let version: bigint | undefined;

    try {
      description = await publicClient.readContract({
        address: feedAddress,
        abi: parseAbi(['function description() view returns (string)']),
        functionName: 'description',
      });
    } catch {
      // Description not available in mock
      description = undefined;
    }

    try {
      version = await publicClient.readContract({
        address: feedAddress,
        abi: parseAbi(['function version() view returns (uint256)']),
        functionName: 'version',
      });
    } catch {
      // Version not available in mock
      version = undefined;
    }

    return {
      decimals,
      currentPrice,
      description,
      version,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to get mock feed info at ${feedAddress}: ${error.message}`
    );
  }
}
