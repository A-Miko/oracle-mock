let mockCometConfig = {
  governor: "0x000000000000000000000000000000000000dEaD", // admin address
  pauseGuardian: "0x000000000000000000000000000000000000dEaD",
  baseToken: "0x0000000000000000000000000000000000000001", // asset token
  baseTokenPriceFeed: "", // mock price feed
  extensionDelegate: "0x0000000000000000000000000000000000000003",
  supplyKink: 1e18,
  supplyPerYearInterestRateSlopeLow: 1e16,
  supplyPerYearInterestRateSlopeHigh: 2e16,
  supplyPerYearInterestRateBase: 1e16,
  borrowKink: 1e18,
  borrowPerYearInterestRateSlopeLow: 1e16,
  borrowPerYearInterestRateSlopeHigh: 2e16,
  borrowPerYearInterestRateBase: 1e16,
  storeFrontPriceFactor: 1e18,
  trackingIndexScale: 1e18,
  baseTokenScale: 1e6,
  baseBorrowMin: 1e6,
  baseTrackingSupplySpeed: 0,
  baseTrackingBorrowSpeed: 0,
  baseMinForRewards: 0,
  targetReserves: 1e6,
  assetConfigs: [
    // Example for one collateral asset; repeat for others as needed
    {
      asset: "0x0000000000000000000000000000000000000004",
      priceFeed: "0x0000000000000000000000000000000000000005",
      decimals: 18,
      borrowCollateralFactor: 1e17,
      liquidateCollateralFactor: 2e17,
      liquidationFactor: 1e17,
      supplyCap: 1e24,
    },
  ],
};

export { mockCometConfig };
