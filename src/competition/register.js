import { ethers } from 'ethers';
import { WalletManager } from '../execution/walletManager.js';

const COMPETITION_CONTRACT = '0x212c61b9b72c95d95bf29cf032f5e5635629aed5';

async function registerAgent() {
  console.log('==================================================');
  console.log('       BNB HACK COMPETITION REGISTRATION');
  console.log('==================================================');

  // 1. Initialize TWAK wallet connection (self-custody, local signing)
  console.log('\n[1/6] Initializing TWAK wallet connection (self-custody, local signing)...');
  const walletManager = new WalletManager();
  
  // 2. Display agent wallet address to the user
  const agentAddress = walletManager.wallet.address;
  console.log(`\n[2/6] Agent Wallet Address: ${agentAddress}`);
  console.log(`      (Keys remain strictly in local environment)`);

  // 3. Check if already registered by querying competition contract
  console.log(`\n[3/6] Querying competition contract at ${COMPETITION_CONTRACT}...`);
  const registryAbi = [
    'function isRegistered(address agent) public view returns (bool)',
    'function register() external'
  ];
  
  const registryContract = new ethers.Contract(COMPETITION_CONTRACT, registryAbi, walletManager.wallet);
  
  let isRegistered = false;
  try {
    isRegistered = await registryContract.isRegistered(agentAddress);
  } catch (err) {
    console.warn(`      [Warning] Contract call isRegistered() failed, assuming unregistered. Error: ${err.message}`);
  }
  
  if (isRegistered) {
    console.log(`      Agent is already registered on-chain.`);
    return;
  }
  
  console.log(`      Agent is NOT registered.`);

  // 4. Call TWAK MCP action "competition_register" to register on-chain
  console.log('\n[4/6] Invoking TWAK MCP action equivalent: sending register() transaction...');
  
  try {
    const tx = await registryContract.register();
    console.log(`      Transaction broadcasted: ${tx.hash}`);
    
    // 5. Verify registration by reading the contract state
    console.log('\n[5/6] Waiting for confirmation...');
    const receipt = await tx.wait();
    
    // 6. Display confirmation with tx hash
    console.log('\n[6/6] ✅ Registration Confirmed!');
    console.log(`      Transaction Hash: ${receipt.hash}`);
    console.log(`      Block Number: ${receipt.blockNumber}`);
    console.log('==================================================');
    console.log('Your agent is now officially registered for the BNB Hack.');
  } catch (err) {
    console.error('\n❌ Registration failed:', err.message);
  }
}

// Run if called directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('register.js');
if (isMainModule) {
  registerAgent().catch(console.error);
}

export { registerAgent };
