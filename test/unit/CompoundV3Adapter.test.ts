import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompoundV3Adapter } from '../../src/discovery/adapters/CompoundV3Adapter';
import type { DetectFeedConfig } from '../../src/discovery/types';
import type { PublicClient } from 'viem';

describe('CompoundV3Adapter - Unit Tests', () => {
  let adapter: CompoundV3Adapter;
  let mockPublicClient: PublicClient;
  let mockConfig: DetectFeedConfig;

  beforeEach(() => {
    adapter = new CompoundV3Adapter();

    // Mock public client
    mockPublicClient = {
      readContract: vi.fn(),
    } as any;

    mockConfig = {
      publicClient: mockPublicClient,
      protocolAddress: '0x46e6b214b524310239732D51387075E0e70970bf',
      assetAddress: '0x4200000000000000000000000000000000000006',
    };
  });

  describe('Adapter properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('Compound V3');
    });

    it('should have correct type', () => {
      expect(adapter.type).toBe('compound-v3');
    });
  });

  describe('canHandle', () => {
    it('should return true if baseToken() succeeds', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce(
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Mock USDC address
      );

      const result = await adapter.canHandle(mockConfig);
      expect(result).toBe(true);
    });

    it('should return false if baseToken() fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValueOnce(
        new Error('Contract not found')
      );

      const result = await adapter.canHandle(mockConfig);
      expect(result).toBe(false);
    });
  });

  describe('discoverFeed', () => {
    it('should successfully discover feed with 8 decimals', async () => {
      // Mock getAssetInfoByAddress response
      const mockAssetInfo = [
        0, // offset
        '0x4200000000000000000000000000000000000006', // asset (WETH)
        '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // priceFeed
        1000000000000000000n, // scale
        900000000000000000n, // borrowCollateralFactor
        930000000000000000n, // liquidateCollateralFactor
        980000000000000000n, // liquidationFactor
        100000000000000000000n, // supplyCap
      ];

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(mockAssetInfo) // getAssetInfoByAddress
        .mockResolvedValueOnce(8) // decimals
        .mockResolvedValueOnce('ETH / USD'); // description

      const result = await adapter.discoverFeed(mockConfig);

      expect(result).toEqual({
        address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
        decimals: 8,
        description: 'ETH / USD',
      });
    });

    it('should successfully discover feed with 18 decimals', async () => {
      const mockAssetInfo = [
        0,
        '0x4200000000000000000000000000000000000006',
        '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // Mock feed
        1000000000000000000n,
        900000000000000000n,
        930000000000000000n,
        980000000000000000n,
        100000000000000000000n,
      ];

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(mockAssetInfo)
        .mockResolvedValueOnce(18); // decimals

      const result = await adapter.discoverFeed(mockConfig);

      expect(result.decimals).toBe(18);
    });

    it('should handle missing description gracefully', async () => {
      const mockAssetInfo = [
        0,
        '0x4200000000000000000000000000000000000006',
        '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
        1000000000000000000n,
        900000000000000000n,
        930000000000000000n,
        980000000000000000n,
        100000000000000000000n,
      ];

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(mockAssetInfo)
        .mockResolvedValueOnce(8)
        .mockRejectedValueOnce(new Error('Description not available'));

      const result = await adapter.discoverFeed(mockConfig);

      expect(result.description).toBeUndefined();
    });

    it('should throw error for unsupported decimals', async () => {
      const mockAssetInfo = [
        0,
        '0x4200000000000000000000000000000000000006',
        '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
        1000000000000000000n,
        900000000000000000n,
        930000000000000000n,
        980000000000000000n,
        100000000000000000000n,
      ];

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(mockAssetInfo)
        .mockResolvedValueOnce(6); // Invalid decimals

      await expect(adapter.discoverFeed(mockConfig)).rejects.toThrow(
        'Unsupported feed decimals: 6 (expected 8 or 18)'
      );
    });
  });
});
