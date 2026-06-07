import { ethers } from 'ethers';

const PANCAKESWAP_V3_ROUTER = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';
const QUOTER_V2 = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997'; // Standard PancakeSwap V3 QuoterV2 on BSC

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)'
];

// QuoterV2 ABI
const QUOTER_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) public returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
];

// Router V3 ABI
const ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
];

export class DexClient {
  constructor(walletManager) {
    this.walletManager = walletManager;
    this.wallet = walletManager.wallet;
    this.provider = walletManager.provider;
    this.routerAddress = PANCAKESWAP_V3_ROUTER;
    this.quoterAddress = QUOTER_V2;
    this.feeTier = 500; // 0.05% default fee tier for V3
  }

  async approveToken(tokenAddress) {
    const maxUint256 = ethers.MaxUint256;
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
    
    const allowance = await tokenContract.allowance(this.wallet.address, this.routerAddress);
    if (allowance > 0n) {
      console.log(`[Dex] Token ${tokenAddress} already approved.`);
      return true;
    }

    console.log(`[Dex] Approving token ${tokenAddress} for PancakeSwap V3 Router...`);
    const tx = await tokenContract.approve(this.routerAddress, maxUint256);
    console.log(`[Dex] Approval TX sent: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait();
    console.log(`[Dex] Token approved successfully.`);
    return true;
  }

  async getQuote(tokenIn, tokenOut, amountIn) {
    const quoterContract = new ethers.Contract(this.quoterAddress, QUOTER_ABI, this.provider);
    
    // We must pass exact struct matching the ABI
    const params = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn,
      fee: this.feeTier,
      sqrtPriceLimitX96: 0
    };

    try {
      // In ethers v6, static call to state-modifying function is done via contract.functionName.staticCall()
      const quoteData = await quoterContract.quoteExactInputSingle.staticCall(params);
      return quoteData.amountOut;
    } catch (err) {
      console.error(`[Dex] Failed to get quote:`, err.message);
      throw err;
    }
  }

  async executeSwap(tokenIn, tokenOut, amountIn, slippagePercent = 1.0) {
    const routerContract = new ethers.Contract(this.routerAddress, ROUTER_ABI, this.wallet);
    
    // 1. Get Quote
    const amountOutQuote = await this.getQuote(tokenIn, tokenOut, amountIn);
    console.log(`[Dex] Quote received: Expected output is ${amountOutQuote.toString()}`);

    // 2. Calculate minimum output based on slippage
    const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));
    const amountOutMinimum = (amountOutQuote * slippageMultiplier) / 10000n;

    console.log(`[Dex] Executing swap with ${slippagePercent}% slippage. Min Out: ${amountOutMinimum.toString()}`);

    // 3. Prepare parameters
    const params = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: this.feeTier,
      recipient: this.wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
      amountIn: amountIn,
      amountOutMinimum: amountOutMinimum,
      sqrtPriceLimitX96: 0
    };

    // 4. Send Transaction
    const tx = await routerContract.exactInputSingle(params, {
      gasLimit: 300000 // typical swap gas limit
    });
    
    console.log(`[Dex] Swap TX broadcasted: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log(`[Dex] Swap executed successfully in block ${receipt.blockNumber}`);
    
    return receipt.hash;
  }
}
