import { WalletManager } from './walletManager.js';
import { ethers } from 'ethers';

async function testLocalSigning() {
  console.log('=========================================');
  console.log('   TWAK LOCAL SIGNING VERIFICATION');
  console.log('=========================================');

  try {
    const wm = new WalletManager();
    const address = wm.wallet.address;
    
    console.log(`\n[Test] Connected Wallet: ${address}`);
    console.log('[Test] Attempting to sign a test payload locally...');

    const payload = 'NeuroSentiment Trader Agent Authorization';
    const signature = await wm.signMessage(payload);

    console.log(`\n[Test] Payload: "${payload}"`);
    console.log(`[Test] Signature: ${signature}`);

    // Verify
    const recoveredAddress = ethers.verifyMessage(payload, signature);
    console.log(`[Test] Recovered Address: ${recoveredAddress}`);

    if (recoveredAddress === address) {
      console.log('\n✅ Local Signing Verified! Keys remain self-custodial.');
      console.log(`✅ Competition Agent Address confirmed as: ${address}`);
    } else {
      console.error('\n❌ Signature verification failed.');
    }

  } catch (err) {
    console.error('\n❌ Failed to initialize wallet or sign message:', err);
  }
}

testLocalSigning();
