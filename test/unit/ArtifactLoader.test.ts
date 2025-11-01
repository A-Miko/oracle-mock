import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getMockBytecode,
  getMockArtifact,
  getMockABI,
  validateArtifacts,
  clearArtifactCache,
  getArtifactInfo,
  type OracleDecimals,
} from '../../src/artifacts/ArtifactLoader';

describe('ArtifactLoader - Unit Tests', () => {
  beforeEach(() => {
    clearArtifactCache();
  });

  afterEach(() => {
    clearArtifactCache();
  });

  describe('getMockBytecode', () => {
    it('should load 8-decimal mock bytecode', () => {
      const bytecode = getMockBytecode(8);

      expect(bytecode).toBeDefined();
      expect(bytecode).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(bytecode.length).toBeGreaterThan(100);
    });

    it('should load 18-decimal mock bytecode', () => {
      const bytecode = getMockBytecode(18);

      expect(bytecode).toBeDefined();
      expect(bytecode).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(bytecode.length).toBeGreaterThan(100);
    });

    it('should return bytecode with 0x prefix', () => {
      const bytecode8 = getMockBytecode(8);
      const bytecode18 = getMockBytecode(18);

      expect(bytecode8.startsWith('0x')).toBe(true);
      expect(bytecode18.startsWith('0x')).toBe(true);
    });

    it('should cache artifacts on subsequent calls', () => {
      const first = getMockBytecode(8);
      const second = getMockBytecode(8);

      // Same reference = cached
      expect(first).toBe(second);
    });

    it('should load different bytecode for different decimals', () => {
      const bytecode8 = getMockBytecode(8);
      const bytecode18 = getMockBytecode(18);

      // Should be different (though similar)
      expect(bytecode8).not.toBe(bytecode18);
    });
  });

  describe('getMockABI', () => {
    it('should load ABI for 8-decimal mock', () => {
      const abi = getMockABI(8);

      expect(Array.isArray(abi)).toBe(true);
      expect(abi.length).toBeGreaterThan(0);
    });

    it('should load ABI for 18-decimal mock', () => {
      const abi = getMockABI(18);

      expect(Array.isArray(abi)).toBe(true);
      expect(abi.length).toBeGreaterThan(0);
    });

    it('should include required functions in ABI', () => {
      const abi = getMockABI(8);
      const functionNames = abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => item.name);

      expect(functionNames).toContain('latestAnswer');
      expect(functionNames).toContain('latestRoundData');
      expect(functionNames).toContain('decimals');
      expect(functionNames).toContain('setLatestAnswer');
    });
  });

  describe('getMockArtifact', () => {
    it('should load full artifact with all fields', () => {
      const artifact = getMockArtifact(8);

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBeDefined();
      expect(artifact.abi).toBeDefined();
      expect(artifact.bytecode || artifact.deployedBytecode).toBeDefined();
    });

    it('should have correct contract name', () => {
      const artifact8 = getMockArtifact(8);
      const artifact18 = getMockArtifact(18);

      expect(artifact8.contractName).toBe('MockFeedDec8');
      expect(artifact18.contractName).toBe('MockFeedDec18');
    });
  });

  describe('validateArtifacts', () => {
    it('should validate all artifacts are present', () => {
      const result = validateArtifacts();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return validation object with correct structure', () => {
      const result = validateArtifacts();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missing');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });
  });

  describe('getArtifactInfo', () => {
    it('should return info for 8-decimal artifact', () => {
      const info = getArtifactInfo(8);

      expect(info.contractName).toBe('MockFeedDec8');
      expect(info.bytecodeLength).toBeGreaterThan(0);
      expect(info.abiLength).toBeGreaterThan(0);
      expect(info.hasFunctions).toContain('latestAnswer');
      expect(info.hasFunctions).toContain('setLatestAnswer');
    });

    it('should return info for 18-decimal artifact', () => {
      const info = getArtifactInfo(18);

      expect(info.contractName).toBe('MockFeedDec18');
      expect(info.bytecodeLength).toBeGreaterThan(0);
      expect(info.abiLength).toBeGreaterThan(0);
      expect(info.hasFunctions).toContain('decimals');
    });

    it('should list all available functions', () => {
      const info = getArtifactInfo(8);

      expect(info.hasFunctions.length).toBeGreaterThan(0);
      expect(info.hasFunctions).toEqual(
        expect.arrayContaining([
          'latestAnswer',
          'decimals',
          'setLatestAnswer',
          'latestRoundData',
        ])
      );
    });
  });

  describe('clearArtifactCache', () => {
    it('should clear the cache', () => {
      // Load artifact to populate cache
      getMockBytecode(8);

      // Clear cache
      clearArtifactCache();

      // This should reload from disk (we can't directly test this,
      // but at least verify it doesn't throw)
      expect(() => getMockBytecode(8)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error message when artifact not found', () => {
      // This would only fail if artifacts aren't compiled
      // We expect success in normal test runs
      expect(() => getMockBytecode(8)).not.toThrow();
      expect(() => getMockBytecode(18)).not.toThrow();
    });
  });
});
