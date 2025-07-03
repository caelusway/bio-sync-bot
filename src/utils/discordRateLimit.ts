import { logger } from './logger';

interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  retryAttempts: number;
  baseDelay: number;
}

class DiscordRateLimiter {
  private requestTimes: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = {
    requestsPerSecond: 8, // Conservative rate (Discord allows 50/sec globally)
    burstLimit: 5, // Max requests in burst
    retryAttempts: 3,
    baseDelay: 125 // 125ms base delay between requests
  }) {
    this.config = config;
  }

  /**
   * Throttle requests to stay within rate limits
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove requests older than 1 second
    this.requestTimes = this.requestTimes.filter(time => time > oneSecondAgo);

    // Check if we're at the rate limit
    if (this.requestTimes.length >= this.config.requestsPerSecond) {
      const oldestRequest = this.requestTimes[0];
      if (oldestRequest) {
        const waitTime = 1000 - (now - oldestRequest) + 50; // Add 50ms buffer
        
        if (waitTime > 0) {
          logger.debug(`Rate limiting: waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Add delay for burst protection
    if (this.requestTimes.length > 0) {
      const lastRequest = this.requestTimes[this.requestTimes.length - 1];
      if (lastRequest) {
        const timeSinceLastRequest = now - lastRequest;
        
        if (timeSinceLastRequest < this.config.baseDelay) {
          const delayNeeded = this.config.baseDelay - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }
      }
    }

    // Record this request
    this.requestTimes.push(Date.now());
  }

  /**
   * Execute a Discord API operation with automatic rate limit handling and retries
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'Discord API call'
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.throttle();
        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Handle Discord rate limit (429)
        if (error.code === 429 || error.status === 429) {
          const retryAfter = (error.retry_after || 1) * 1000;
          logger.warn(`🚫 Rate limited on ${operationName}, waiting ${retryAfter}ms (attempt ${attempt}/${this.config.retryAttempts})`);
          
          if (attempt < this.config.retryAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
          }
        }
        
        // Handle other Discord errors that should be retried
        if (this.shouldRetryError(error) && attempt < this.config.retryAttempts) {
          const delay = this.calculateBackoffDelay(attempt);
          logger.warn(`⚠️ ${operationName} failed, retrying in ${delay}ms (attempt ${attempt}/${this.config.retryAttempts}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If we're here, we've exhausted retries or it's a non-retryable error
        break;
      }
    }

    logger.error(`❌ ${operationName} failed after ${this.config.retryAttempts} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Process an array of operations in batches with rate limiting
   */
  async processBatch<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    batchSize: number = 5,
    operationName: string = 'batch operation'
  ): Promise<R[]> {
    const results: R[] = [];
    const totalBatches = Math.ceil(items.length / batchSize);

    logger.info(`🔄 Processing ${items.length} items in ${totalBatches} batches of ${batchSize}`);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      logger.debug(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

      // Process batch items in parallel with rate limiting
      const batchPromises = batch.map(async (item, index) => {
        try {
          return await this.executeWithRetry(
            () => operation(item),
            `${operationName} ${i + index + 1}`
          );
        } catch (error) {
          logger.error(`Failed to process item ${i + index + 1} in ${operationName}:`, error);
          throw error;
        }
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        logger.error(`Batch ${batchNumber} failed:`, error);
        throw error;
      }

      // Add delay between batches (except for the last batch)
      if (i + batchSize < items.length) {
        const interBatchDelay = 200; // 200ms between batches
        logger.debug(`Waiting ${interBatchDelay}ms between batches...`);
        await new Promise(resolve => setTimeout(resolve, interBatchDelay));
      }
    }

    logger.info(`✅ Completed processing ${items.length} items successfully`);
    return results;
  }

  private shouldRetryError(error: any): boolean {
    // Retry on network errors, timeouts, and some Discord errors
    const retryableCodes = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EAI_AGAIN'
    ];

    const retryableHttpCodes = [429, 500, 502, 503, 504];

    return (
      retryableCodes.includes(error.code) ||
      retryableHttpCodes.includes(error.status) ||
      error.message?.includes('timeout') ||
      error.message?.includes('network')
    );
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { requestsInLastSecond: number; config: RateLimitConfig } {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const requestsInLastSecond = this.requestTimes.filter(time => time > oneSecondAgo).length;

    return {
      requestsInLastSecond,
      config: this.config
    };
  }
}

// Create singleton instance
export const discordRateLimiter = new DiscordRateLimiter();

// Export class for custom instances if needed
export { DiscordRateLimiter };
export type { RateLimitConfig }; 