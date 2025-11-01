import { describe, it, expect } from 'vitest';
import {
  createClients,
  getChainFromNetwork,
  type SupportedNetwork,
} from '../../src/client/ClientFactory';
import { base, mainnet, arbitrum } from 'viem/chains';

describe('ClientFactory - Unit Tests', () => {
  describe('getChainFromNetwork', () => {
    it('should return Base chain config', () => {
      const chain = getChainFromNetwork('base');
      expect(chain.id).toBe(base.id);
      expect(chain.name).toBe(base.name);
    });

    it('should return Ethereum mainnet chain config', () => {
      const chain = getChainFromNetwork('ethereum');
      expect(chain.id).toBe(mainnet.id);
      expect(chain.name).toBe(mainnet.name);
    });

    it('should return Arbitrum chain config', () => {
      const chain = getChainFromNetwork('arbitrum');
      expect(chain.id).toBe(arbitrum.id);
      expect(chain.name).toBe(arbitrum.name);
    });

    it('should return localhost chain config', () => {
      const chain = getChainFromNetwork('localhost');
      expect(chain.id).toBe(31337);
      expect(chain.name).toBe('Localhost');
    });
  });

  describe('createClients', () => {
    it('should create clients with network name', () => {
      const { publicClient, walletClient, chain } = createClients({
        rpcUrl: 'http://localhost:8545',
        network: 'base',
      });

      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
      expect(chain.id).toBe(base.id);
    });

    it('should create clients with custom chain', () => {
      const customChain = {
        id: 999,
        name: 'Custom Chain',
        nativeCurrency: { name: 'Test', symbol: 'TEST', decimals: 18 },
        rpcUrls: {
          default: { http: ['http://localhost:8545'] },
          public: { http: ['http://localhost:8545'] },
        },
      };

      const { publicClient, walletClient, chain } = createClients({
        rpcUrl: 'http://localhost:8545',
        chain: customChain,
      });

      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
      expect(chain.id).toBe(999);
    });

    it('should default to localhost if no network or chain provided', () => {
      const { chain } = createClients({
        rpcUrl: 'http://localhost:8545',
      });

      expect(chain.id).toBe(31337);
      expect(chain.name).toBe('Localhost');
    });

    it('should create wallet client with private key', () => {
      const privateKey =
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

      const { walletClient } = createClients({
        rpcUrl: 'http://localhost:8545',
        network: 'localhost',
        privateKey,
      });

      expect(walletClient.account).toBeDefined();
      expect(walletClient.account?.address).toBeDefined();
    });

    it('should return all required client properties', () => {
      const result = createClients({
        rpcUrl: 'http://localhost:8545',
        network: 'base',
      });

      expect(result).toHaveProperty('publicClient');
      expect(result).toHaveProperty('walletClient');
      expect(result).toHaveProperty('chain');
    });

    it('should create clients for all supported networks', () => {
      const networks: SupportedNetwork[] = [
        'base',
        'ethereum',
        'arbitrum',
        'optimism',
        'polygon',
        'localhost',
      ];

      networks.forEach((network) => {
        const { publicClient, chain } = createClients({
          rpcUrl: 'http://localhost:8545',
          network,
        });

        expect(publicClient).toBeDefined();
        expect(chain).toBeDefined();
      });
    });
  });
});
