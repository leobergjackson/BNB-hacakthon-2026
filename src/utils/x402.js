import { logger } from './logger.js';

export class X402Client {
  constructor(walletManager) {
    this.walletManager = walletManager;
    this.totalSessionSpend = 0;
    this.dailyCap = 5.00; // Hardcoded $5.00 daily limit for safety
    this.costPerRequest = 0.01; // Mock $0.01 per API hit
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * Resets the spend cap daily
   */
  _checkDailyLimits() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.totalSessionSpend = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Attempts to pay for an API request using the x402 protocol.
   * Returns the signed L402 authorization header.
   */
  async payForRequest(service, endpoint) {
    this._checkDailyLimits();

    if (this.totalSessionSpend + this.costPerRequest > this.dailyCap) {
      throw new Error(`[X402Client] Daily spending cap of $${this.dailyCap.toFixed(2)} exceeded. Cannot pay for request to ${endpoint}`);
    }

    // Generate the L402 token by signing the payment via TWAK locally
    // The WalletManager ensures the private key never leaves the environment
    const authHeader = await this.walletManager.generateL402PaymentToken(this.costPerRequest.toString());
    
    // Simulate transaction hash for logging
    // In a real x402, there might be an LN invoice or an on-chain tx, or state channel.
    const mockTxHash = `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`;

    // Record spend
    this.totalSessionSpend += this.costPerRequest;

    // Log micropayment
    logger.logX402({
      service,
      endpoint,
      amount: this.costPerRequest,
      txHash: mockTxHash
    });

    console.log(`[X402Client] Paid $${this.costPerRequest.toFixed(2)} for ${service} (${endpoint}). Session spend: $${this.totalSessionSpend.toFixed(2)}`);

    return authHeader;
  }
}
