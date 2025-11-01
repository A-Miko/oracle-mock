import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Artifact metadata for compiled mock feeds
 */
export interface ArtifactMetadata {
  contractName: string;
  bytecode: string;
  abi: any[];
  deployedBytecode: string;
}

/**
 * Supported oracle decimal types
 */
export type OracleDecimals = 8 | 18;

/**
 * Cache for loaded artifacts to avoid repeated file I/O
 */
const artifactCache = new Map<OracleDecimals, ArtifactMetadata>();

/**
 * Get the module's root directory
 * Works in CommonJS context (Node.js with "type": "commonjs")
 */
function getModuleRoot(): string {
  // For CommonJS - __dirname is always available
  if (typeof __dirname !== 'undefined') {
    return join(__dirname, '..', '..');
  }

  // Fallback to process.cwd() (should never reach here in CommonJS)
  return process.cwd();
}

/**
 * Resolve artifact path based on decimals
 * Tries multiple common locations
 */
function getArtifactPath(decimals: OracleDecimals): string {
  const moduleRoot = getModuleRoot();
  const artifactName = decimals === 8 ? 'MockFeedDec8' : 'MockFeedDec18';

  // Try multiple possible locations
  const possiblePaths = [
    // Standard Hardhat location
    join(moduleRoot, 'artifacts', 'contracts', `${artifactName}.sol`, `${artifactName}.json`),
    // Simplified location
    join(moduleRoot, 'artifacts', `${artifactName}.json`),
    // Dist folder (for published npm packages)
    join(moduleRoot, 'dist', 'artifacts', 'contracts', `${artifactName}.sol`, `${artifactName}.json`),
    join(moduleRoot, 'dist', 'artifacts', `${artifactName}.json`),
    // Alternative contract folder structure
    join(moduleRoot, 'artifacts', 'src', 'contracts', `${artifactName}.sol`, `${artifactName}.json`),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    `Could not find artifact for ${artifactName}.\n` +
    `Searched in:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}\n\n` +
    `Make sure you've run: npx hardhat compile`
  );
}

/**
 * Load artifact from disk with caching
 */
function loadArtifact(decimals: OracleDecimals): ArtifactMetadata {
  // Check cache first
  if (artifactCache.has(decimals)) {
    return artifactCache.get(decimals)!;
  }

  const artifactPath = getArtifactPath(decimals);
  
  try {
    const artifactContent = readFileSync(artifactPath, 'utf-8');
    const artifact = JSON.parse(artifactContent) as ArtifactMetadata;

    // Validate artifact structure
    if (!artifact.bytecode && !artifact.deployedBytecode) {
      throw new Error('Artifact missing bytecode fields');
    }

    if (!artifact.abi || !Array.isArray(artifact.abi)) {
      throw new Error('Artifact missing or invalid ABI');
    }

    // Cache for future use
    artifactCache.set(decimals, artifact);

    return artifact;
  } catch (error: any) {
    throw new Error(
      `Failed to load artifact for MockFeedDec${decimals} from ${artifactPath}: ${error.message}`
    );
  }
}

/**
 * Get the runtime bytecode for a mock oracle with specified decimals
 * 
 * @param decimals - Oracle decimals (8 for USD pairs like ETH/USD, 18 for ETH pairs)
 * @returns Hex string of deployed bytecode ready to use with hardhat_setCode
 * 
 * @example
 * ```
 * // For ETH/USD feed (8 decimals)
 * const bytecode = getMockBytecode(8);
 * await provider.send("hardhat_setCode", [feedAddress, bytecode]);
 * 
 * // For wstETH/ETH feed (18 decimals)
 * const bytecode = getMockBytecode(18);
 * await provider.send("hardhat_setCode", [feedAddress, bytecode]);
 * ```
 */
export function getMockBytecode(decimals: OracleDecimals): string {
  const artifact = loadArtifact(decimals);

  // Use deployedBytecode (runtime code) not bytecode (creation code)
  // This is what gets executed when the contract is called
  let bytecode = artifact.deployedBytecode || artifact.bytecode;

  if (!bytecode) {
    throw new Error(`No bytecode found in artifact for MockFeedDec${decimals}`);
  }

  // Ensure 0x prefix
  if (!bytecode.startsWith('0x')) {
    bytecode = `0x${bytecode}`;
  }

  return bytecode;
}

/**
 * Get the full artifact including ABI
 * Useful for creating contract instances after deployment
 * 
 * @param decimals - Oracle decimals
 * @returns Complete artifact metadata
 * 
 * @example
 * ```
 * const artifact = getMockArtifact(8);
 * const contract = new ethers.Contract(address, artifact.abi, signer);
 * ```
 */
export function getMockArtifact(decimals: OracleDecimals): ArtifactMetadata {
  return loadArtifact(decimals);
}

/**
 * Get the ABI for a mock oracle
 * 
 * @param decimals - Oracle decimals
 * @returns Contract ABI array
 * 
 * @example
 * ```
 * const abi = getMockABI(8);
 * const contract = new ethers.Contract(address, abi, provider);
 * await contract.setLatestAnswer(ethers.parseUnits("2000", 8));
 * ```
 */
export function getMockABI(decimals: OracleDecimals): any[] {
  const artifact = loadArtifact(decimals);
  return artifact.abi;
}

/**
 * Validate that required artifacts are present
 * Useful for testing and pre-deployment checks
 * 
 * @returns Validation result with list of missing artifacts
 * 
 * @example
 * ```
 * const { valid, missing } = validateArtifacts();
 * if (!valid) {
 *   console.error('Missing artifacts:', missing);
 *   process.exit(1);
 * }
 * ```
 */
export function validateArtifacts(): { valid: boolean; missing: OracleDecimals[] } {
  const missing: OracleDecimals[] = [];

  for (const decimals of [8, 18] as OracleDecimals[]) {
    try {
      getMockBytecode(decimals);
    } catch {
      missing.push(decimals);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Clear the artifact cache
 * Useful for testing or when artifacts are updated
 */
export function clearArtifactCache(): void {
  artifactCache.clear();
}

/**
 * Get information about a loaded artifact
 * Useful for debugging
 */
export function getArtifactInfo(decimals: OracleDecimals): {
  contractName: string;
  bytecodeLength: number;
  abiLength: number;
  hasFunctions: string[];
} {
  const artifact = loadArtifact(decimals);
  const functions = artifact.abi
    .filter((item: any) => item.type === 'function')
    .map((item: any) => item.name);

  return {
    contractName: artifact.contractName,
    bytecodeLength: artifact.deployedBytecode?.length || artifact.bytecode?.length || 0,
    abiLength: artifact.abi.length,
    hasFunctions: functions,
  };
}
