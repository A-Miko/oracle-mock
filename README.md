1. Core Infrastructure Layer
src/artifacts/ArtifactLoader.ts

Loads MockFeedDec8.json and MockFeedDec18.json bytecode

Exports getMockBytecode(decimals: 8 | 18): string

Handles artifact path resolution for different project structures

src/client/ClientFactory.ts

Creates viem publicClient and walletClient for any RPC URL

Configurable chain (Base, Ethereum, Arbitrum, etc.)

Exports createClients(rpcUrl: string, chain: Chain)

2. Price Feed Discovery Layer
src/discovery/FeedDetector.ts

async function detectPriceFeed(protocolAddress, assetAddress): Promise<FeedInfo>

Protocol-agnostic: tries common patterns (Morpho, Compound, Aave)

Returns { feedAddress, decimals, description }

src/discovery/ProtocolAdapters.ts

MorphoAdapter: Reads oracle.price() to find feeds

CompoundV3Adapter: Reads getAssetInfoByAddress().priceFeed

AaveAdapter: Reads getSourceOfAsset()

GenericAdapter: Fallback for direct feed address

Each returns FeedInfo[]

3. Mock Deployment & Price Setting Layer
src/mock/MockDeployer.ts

async function deployMockAtAddress(feedAddress, decimals, rpcUrl)

Uses hardhat_setCode or anvil_setCode (auto-detects)

Validates deployment with latestAnswer() call

Returns MockFeed handle

src/mock/PriceSetter.ts

async function setPrice(feedAddress, newPrice, multiplier?)

Supports absolute price OR percentage change

Handles decimal conversion automatically

Verifies price was set correctly

4. Validation & Verification Layer
src/validation/PriceVerifier.ts

async function verifyPriceChange(feedAddress, expectedPrice)

Reads latestAnswer() from feed

Compares with expected, returns success/failure

Logs before/after prices

src/validation/ProtocolVerifier.ts

async function verifyProtocolSeesPrice(protocolAddress, assetAddress, expectedPrice)

Protocol-specific: calls Compound's getPrice(), Morpho's oracle.price(), etc.

Confirms protocol internals reflect the mock price

5. Utility Layer
src/utils/DecimalConverter.ts

convertToOracleDecimals(value, decimals)

parseOraclePrice(rawValue, decimals)

src/utils/StorageHelper.ts

calculateStorageSlot(key, mapSlot) for mapping slots

setStorageAt(address, slot, value)

src/utils/ChainDetector.ts

Auto-detect if using Hardhat (hardhat_*) or Foundry (anvil_*) RPC methods

Returns correct method names

6. High-Level API (Public Interface)
src/index.ts (main entry point)

typescript
export {
  // Simple API
  setOraclePrice,
  resetOraclePrice,
  
  // Advanced API
  discoverFeeds,
  deployMockFeed,
  verifyPrice,
  
  // Types
  FeedInfo,
  MockFeedOptions,
  ProtocolType
}
Simple API function:

typescript
export async function setOraclePrice(options: {
  rpcUrl: string;
  protocol: 'compound-v3' | 'morpho' | 'aave' | 'generic';
  network: 'base' | 'ethereum' | 'arbitrum';
  protocolAddress: string;
  assetAddress: string;
  newPrice: string | bigint;
  priceChangePercent?: number; // Alternative to absolute price
}): Promise<void>
7. Contract Artifacts
contracts/MockFeedDec8.sol

8-decimal mock (for USD pairs: ETH/USD, BTC/USD)

Implements full Chainlink AggregatorV3 interface

contracts/MockFeedDec18.sol

18-decimal mock (for ETH-denominated pairs)

Same interface, different decimals

8. Configuration & Presets
src/config/NetworkConfig.ts

Chain configs: RPC defaults, chain IDs, explorers

Base, Ethereum, Arbitrum, Optimism, Polygon

src/config/ProtocolConfig.ts

Known protocol addresses by network

Compound V3 USDC/WETH on Base

Morpho Blue on Base/Ethereum

Aave V3 on Base/Ethereum

9. Testing Suite
test/unit/ - Unit tests for each component

test/integration/ - Full workflow tests

compound-v3.test.ts

morpho.test.ts

aave.test.ts

10. Documentation & Examples
README.md - Installation, quick start, API reference

examples/

compound-v3-liquidation-test.ts

morpho-price-manipulation.ts

aave-health-factor-test.ts

Module Architecture Summary
text
Core Flow:
User calls setOraclePrice()
    ↓
→ ChainDetector: Detect Hardhat vs Foundry
→ ProtocolAdapter: Discover price feed(s) for protocol+asset
→ ArtifactLoader: Get correct mock bytecode (8 or 18 decimals)
→ MockDeployer: Replace feed bytecode with mock
→ PriceSetter: Write new price to mock's storage
→ PriceVerifier: Confirm feed returns new price
→ ProtocolVerifier: Confirm protocol sees new price
    ↓
Success ✅
Key Benefits of This Structure
✅ Protocol-agnostic: Easy to add new protocol adapters

✅ Network-agnostic: Works on any EVM fork (Base, Ethereum, Arbitrum, etc.)

✅ Testable: Each component unit-testable in isolation

✅ Extensible: Add new protocols without touching core logic

✅ Type-safe: Full TypeScript with proper interfaces

✅ Single responsibility: Each module does one thing well

✅ Backward compatible: Can keep your CLI script as a thin wrapper

Usage Example After Modularization
typescript
// In your Compound V3 test
import { setOraclePrice } from "@miko/oracle-mock";

await setOraclePrice({
  rpcUrl: "http://localhost:8545",
  protocol: "compound-v3",
  network: "base",
  protocolAddress: BASE_COMET_USDC,
  assetAddress: BASE_WETH,
  newPrice: "200000000000", // $2,000
});

// Position now liquidatable! ✅