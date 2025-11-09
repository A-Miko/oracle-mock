import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { ethers } from 'ethers';

dotenv.config();

const FORK_URL = process.env.BASE_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/...";
const CHAIN_ID = "31337";
const PORT = "8545";
const PROVIDER_URL = `http://localhost:${PORT}`;
const MNEMONIC = "test test test test test test test test test test test junk";
const FORK_BLOCK_NUMBER = "37744731";

/** Wait until Anvil JSON-RPC responds */
async function waitForAnvil() {
  const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  const start = Date.now();
  
  while (true) {
    try {
      // Ethers v6: send() method works the same
      await provider.send("eth_blockNumber", []);
      console.log("✅ Anvil RPC ready!");
      return;
    } catch {
      if (Date.now() - start > 30000) {
        throw new Error("Timeout waiting for Anvil RPC");
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

async function main() {
  const args = [
    "--fork-url", FORK_URL,
    "--fork-block-number", FORK_BLOCK_NUMBER,
    "--chain-id", CHAIN_ID,
    "--port", PORT,
    "--mnemonic", MNEMONIC,
    "--accounts", "10",
    "--balance", "10000",
    "--hardfork", "cancun", // Use latest hardfork
    "--steps-tracing",      // Enable debug methods
    "--block-time", "1",
  ];

  console.log(`🚀 Launching Anvil Base fork at block ${FORK_BLOCK_NUMBER}...`);
  const anvil = spawn("anvil", args, { stdio: "inherit" });

  // Save PID for cleanup
  const pidPath = path.resolve(__dirname, "../anvil.pid");
  writeFileSync(pidPath, String(anvil.pid));

  // Wait for Anvil to be ready
  await waitForAnvil();
  
  console.log(`✅ Anvil running at ${PROVIDER_URL} (PID: ${anvil.pid})`);
  console.log("Press Ctrl+C to stop");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
