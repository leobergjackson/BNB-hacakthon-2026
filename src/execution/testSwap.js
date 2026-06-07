import { WalletManager } from './walletManager.js';
import { DexClient } from './dex.js';
import { ethers } from 'ethers';

const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';
const CAKE_BSC = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';

async function runTestSwap() {
  console.log('==================================================');
  console.log('      PANCAKESWAP V3 INTEGRATION TEST');
  console.log('==================================================');

  try {
    const walletManager = new WalletManager();
    const dexClient = new DexClient(walletManager);

    console.log(`\n[Test] Connected Wallet: ${walletManager.wallet.address}`);
    
    // Test: $0.50 Swap of USDT to CAKE
    const amountIn = ethers.parseUnits('0.5', 18); // USDT on BSC is 18 decimals

    // 1. Approve USDT
    await dexClient.approveToken(USDT_BSC);

    // 2. Execute Swap
    console.log(`\n[Test] Initiating Swap of 0.50 USDT for CAKE...`);
    const txHash = await dexClient.executeSwap(USDT_BSC, CAKE_BSC, amountIn, 1.0); // 1% slippage
    
    console.log('\n==================================================');
    console.log('✅ Swap Execution Completed Successfully!');
    console.log(`Transaction Hash: ${txHash}`);
    console.log('==================================================');
  } catch (err) {
    console.error('\n❌ Swap Test Failed:', err.message);
    if (err.info && err.info.error && err.info.error.message) {
      console.error('RPC Error:', err.info.error.message);
    }
  }
}

runTestSwap();
