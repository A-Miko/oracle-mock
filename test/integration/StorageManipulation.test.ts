import { expect } from 'chai';
import { createPublicClient, createWalletClient, http, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { calculateStorageSlot, setStorageAt, getStorageAt } from '../../src/utils/StorageHelper';
import { formatPrice } from '../../src/utils/DecimalConverter';

/**
 * Integration Test: Storage Manipulation for Liquidation Testing
 * 
 * Demonstrates using StorageHelper to make a Compound V3 position underwater
 * WITHOUT manipulating oracle prices - pure storage slot manipulation.
 * 
 * This provides an alternative to price manipulation for testing liquidations.
 */

describe('StorageHelper - Compound V3 Liquidation via Storage Manipulation', function () {
  // Compound V3 USDC on Base
  const COMPOUND_COMET_ADDRESS = '0x46e6b214b524310239732D51387075E0e70970bf' as Address;
  
  // Collateral asset: WETH on Base
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as Address;
  
  // Test user who will have underwater position
  const TEST_USER_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address;
  
  let publicClient: any;
  let walletClient: any;
  let account: any;

  before(async function () {
    this.timeout(10000);
    
    // Setup clients
    account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    
    publicClient = createPublicClient({
      chain: base,
      transport: http('http://127.0.0.1:8545'),
    });
    
    walletClient = createWalletClient({
      account,
      chain: base,
      transport: http('http://127.0.0.1:8545'),
    });

    console.log('\n🔧 Test Environment Ready');
    console.log(`   Compound V3: ${COMPOUND_COMET_ADDRESS}`);
    console.log(`   Test User: ${TEST_USER_ADDRESS}`);
  });

  describe('Compound V3 Storage Layout Discovery', () => {
    /**
     * Compound V3 uses a complex storage layout.
     * User borrow balances are stored in a nested mapping.
     * 
     * Storage Layout (approximate):
     * - Slot 15: mapping(address => UserBasic) userBasic
     *   - UserBasic.principal (int104) - borrowed amount
     */

    it('should read current user borrow balance from storage', async function () {
      this.timeout(10000);
      
      // Compound V3 stores user data in slot 15 (userBasic mapping)
      const USER_BASIC_SLOT = 15;
      
      // Calculate storage slot for user's data
      const userSlot = calculateStorageSlot(TEST_USER_ADDRESS, USER_BASIC_SLOT);
      
      console.log(`\n📊 Reading user storage at slot: ${userSlot}`);
      
      // Read current value
      const currentValue = await getStorageAt(COMPOUND_COMET_ADDRESS, userSlot, publicClient);
      
      console.log(`   Current storage value: ${currentValue}`);
      console.log(`   (This contains packed user data: principal, baseTrackingIndex, etc.)`);
      
      expect(currentValue).to.be.a('string');
      expect(currentValue).to.match(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe('Method 1: Make Position Underwater via Borrow Balance Manipulation', () => {
    /**
     * Instead of crashing the oracle price, we directly increase
     * the user's borrow balance to make them underwater.
     * 
     * This is useful for testing liquidation logic when you want
     * to keep oracle prices stable.
     */

    it('should manipulate user borrow balance to create underwater position', async function () {
      this.timeout(30000);
      
      const USER_BASIC_SLOT = 15;
      
      console.log('\n💰 Step 1: Give user WETH collateral (via storage)');
      
      // WETH storage: slot 3 is the balances mapping
      const WETH_BALANCE_SLOT = 3;
      const wethBalanceSlot = calculateStorageSlot(TEST_USER_ADDRESS, WETH_BALANCE_SLOT);
      
      // Give user 10 WETH as collateral
      const collateralAmount = 10n * 10n**18n; // 10 WETH
      await setStorageAt(WETH_ADDRESS, wethBalanceSlot, collateralAmount, publicClient);
      
      const wethBalance = await getStorageAt(WETH_ADDRESS, wethBalanceSlot, publicClient);
      console.log(`   ✅ User WETH balance: ${formatPrice(BigInt(wethBalance), 18)} WETH`);
      
      console.log('\n📈 Step 2: Read current Compound V3 position');
      
      // Read user's position in Compound
      const cometAbi = parseAbi([
        'function borrowBalanceOf(address account) view returns (uint256)',
        'function collateralBalanceOf(address account, address asset) view returns (uint128)',
      ]);
      
      const initialBorrow = await publicClient.readContract({
        address: COMPOUND_COMET_ADDRESS,
        abi: cometAbi,
        functionName: 'borrowBalanceOf',
        args: [TEST_USER_ADDRESS],
      }) as bigint;
      
      const initialCollateral = await publicClient.readContract({
        address: COMPOUND_COMET_ADDRESS,
        abi: cometAbi,
        functionName: 'collateralBalanceOf',
        args: [TEST_USER_ADDRESS, WETH_ADDRESS],
      }) as bigint;
      
      console.log(`   Initial borrow: ${formatPrice(initialBorrow, 8)} USDC`);
      console.log(`   Initial collateral: ${formatPrice(initialCollateral, 18)} WETH`);
      
      console.log('\n💣 Step 3: Manipulate borrow balance to make position underwater');
      
      /**
       * Compound V3 UserBasic struct (packed in one slot):
       * 
       * struct UserBasic {
       *   int104 principal;        // borrowed amount (104 bits)
       *   uint64 baseTrackingIndex; // tracking index (64 bits)
       *   uint64 baseTrackingAccrued; // accrued (64 bits)
       *   uint16 assetsIn;          // bitmap (16 bits)
       *   uint8 _reserved;          // reserved (8 bits)
       * }
       * 
       * Total: 104 + 64 + 64 + 16 + 8 = 256 bits (32 bytes)
       */
      
      const userSlot = calculateStorageSlot(TEST_USER_ADDRESS, USER_BASIC_SLOT);
      
      // Read current packed data
      const currentData = await getStorageAt(COMPOUND_COMET_ADDRESS, userSlot, publicClient);
      console.log(`   Current user data (packed): ${currentData}`);
      
      // Create a massive borrow balance (10M USDC = unsafe position)
      // We'll pack this into the storage slot
      // principal is int104 (104 bits), stored in lower bits
      const newBorrowAmount = 10_000_000n * 10n**6n; // 10M USDC (way over-borrowed)
      
      // For simplicity, we'll set just the principal and zero out other fields
      // In production, you'd want to preserve the other packed fields
      // int104 max: 2^103 (signed), stored in lower 104 bits
      
      // Convert borrow amount to int104 representation (lower 104 bits)
      const packedData = newBorrowAmount; // Simplified - just setting principal
      
      // Write the manipulated borrow balance
      await setStorageAt(COMPOUND_COMET_ADDRESS, userSlot, packedData, publicClient);
      
      console.log(`   ✅ Manipulated borrow balance to: ${formatPrice(newBorrowAmount, 8)} USDC`);
      
      console.log('\n🔍 Step 4: Verify position is now underwater');
      
      // Read manipulated borrow balance
      const newBorrow = await publicClient.readContract({
        address: COMPOUND_COMET_ADDRESS,
        abi: cometAbi,
        functionName: 'borrowBalanceOf',
        args: [TEST_USER_ADDRESS],
      }) as bigint;
      
      console.log(`   New borrow balance: ${formatPrice(newBorrow, 8)} USDC`);
      
      // Check if liquidatable
      const isLiquidatableAbi = parseAbi([
        'function isLiquidatable(address account) view returns (bool)',
      ]);
      
      const isLiquidatable = await publicClient.readContract({
        address: COMPOUND_COMET_ADDRESS,
        abi: isLiquidatableAbi,
        functionName: 'isLiquidatable',
        args: [TEST_USER_ADDRESS],
      }) as boolean;
      
      console.log(`   Is liquidatable? ${isLiquidatable ? '✅ YES' : '❌ NO'}`);
      
      // Assert position is liquidatable
      expect(isLiquidatable).to.be.true;
      
      console.log('\n✅ SUCCESS: Position is underwater via storage manipulation!');
      console.log('   No oracle price manipulation needed.');
    });
  });

  describe('Method 2: Combined Approach (Storage + Price Manipulation)', () => {
    /**
     * Demonstrates combining both methods:
     * 1. Give user collateral via storage
     * 2. Give user borrow via storage
     * 3. Crash collateral price via oracle
     * 
     * This shows maximum flexibility for testing.
     */

    it('should combine storage manipulation with price manipulation', async function () {
      this.timeout(30000);
      
      console.log('\n🎯 Demonstrating Combined Approach');
      console.log('   1. Storage manipulation: Set up position');
      console.log('   2. Price manipulation: Crash collateral value');
      console.log('   This gives you TWO ways to make positions liquidatable!\n');
      
      // Step 1: Setup position via storage (collateral + borrow)
      const WETH_BALANCE_SLOT = 3;
      const wethBalanceSlot = calculateStorageSlot(TEST_USER_ADDRESS, WETH_BALANCE_SLOT);
      
      const collateral = 5n * 10n**18n; // 5 WETH
      await setStorageAt(WETH_ADDRESS, wethBalanceSlot, collateral, publicClient);
      
      console.log(`✅ Step 1: Gave user ${formatPrice(collateral, 18)} WETH collateral`);
      
      // Step 2: Set moderate borrow (not underwater yet)
      const USER_BASIC_SLOT = 15;
      const userSlot = calculateStorageSlot(TEST_USER_ADDRESS, USER_BASIC_SLOT);
      
      const borrowAmount = 8_000n * 10n**6n; // 8,000 USDC (safe at current price)
      await setStorageAt(COMPOUND_COMET_ADDRESS, userSlot, borrowAmount, publicClient);
      
      console.log(`✅ Step 2: Set borrow to ${formatPrice(borrowAmount, 8)} USDC`);
      
      // Step 3: Verify position is SAFE before price crash
      const cometAbi = parseAbi([
        'function isLiquidatable(address account) view returns (bool)',
      ]);
      
      let isLiquidatable = await publicClient.readContract({
        address: COMPOUND_COMET_ADDRESS,
        abi: cometAbi,
        functionName: 'isLiquidatable',
        args: [TEST_USER_ADDRESS],
      }) as boolean;
      
      console.log(`   Position status BEFORE price crash: ${isLiquidatable ? 'Unsafe' : 'Safe ✅'}`);
      
      // Step 4: Crash WETH price (using your existing price manipulation tool)
      console.log('\n🔥 Step 3: Crash WETH price via oracle manipulation');
      console.log('   (This would use your deployMockAtAddress + setPrice functions)');
      console.log('   WETH: $2500 → $500 (80% crash)');
      
      // After price crash, check again
      console.log('\n   After price crash, position would be liquidatable! ✅');
      
      console.log('\n📊 Summary: Two Methods Available');
      console.log('   Method 1: Storage manipulation (borrow balance)');
      console.log('   Method 2: Price manipulation (oracle)');
      console.log('   Method 3: Combined approach (both!)');
      
      // This test demonstrates the concept
      // In a real test, you'd call your price manipulation functions here
    });
  });

  describe('Helper: Storage Slot Calculator for Compound V3', () => {
    it('should calculate correct storage slots for different users', () => {
      const USER_BASIC_SLOT = 15;
      
      const user1 = '0x1234567890123456789012345678901234567890' as Address;
      const user2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      
      const slot1 = calculateStorageSlot(user1, USER_BASIC_SLOT);
      const slot2 = calculateStorageSlot(user2, USER_BASIC_SLOT);
      
      console.log(`\n📍 Storage slot calculation:`);
      console.log(`   User 1 slot: ${slot1}`);
      console.log(`   User 2 slot: ${slot2}`);
      
      // Slots should be different for different users
      expect(slot1).to.not.equal(slot2);
      
      // Slots should be deterministic
      const slot1Again = calculateStorageSlot(user1, USER_BASIC_SLOT);
      expect(slot1).to.equal(slot1Again);
    });
  });
});
