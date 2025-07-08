import { logger } from './logger';

interface TelegramRateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  retryAttempts: number;
  baseDelay: number;
}

class TelegramRateLimiter {
  private requestTimes: number[] = [];
  private config: TelegramRateLimitConfig;

  constructor(config: TelegramRateLimitConfig = {
    requestsPerSecond: 30, // Telegram allows 30 requests per second
    burstLimit: 20, // Max requests in burst
    retryAttempts: 3,
    baseDelay: 100 // 100ms base delay between requests
  }) {
    this.config = config;
  }

  /**
   * Throttle requests to stay within Telegram rate limits
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
          logger.debug(`Telegram rate limiting: waiting ${waitTime}ms`);
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
   * Execute a Telegram API operation with automatic rate limit handling and retries
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'Telegram API call'
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
        
        // Handle Telegram rate limit (429)
        if (error.response?.status === 429) {
          const retryAfter = (error.response.parameters?.retry_after || 1) * 1000;
          logger.warn(`🚫 Telegram rate limited on ${operationName}, waiting ${retryAfter}ms (attempt ${attempt}/${this.config.retryAttempts})`);
          
          if (attempt < this.config.retryAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
          }
        }
        
        // Handle other Telegram errors that should be retried
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
    batchSize: number = 10,
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
        const interBatchDelay = 100; // 100ms between batches
        logger.debug(`Waiting ${interBatchDelay}ms between batches...`);
        await new Promise(resolve => setTimeout(resolve, interBatchDelay));
      }
    }

    logger.info(`✅ Completed processing ${items.length} items successfully`);
    return results;
  }

  private shouldRetryError(error: any): boolean {
    // Retry on network errors, timeouts, and some Telegram errors
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
      retryableHttpCodes.includes(error.response?.status) ||
      error.message?.includes('timeout') ||
      error.message?.includes('network') ||
      error.message?.includes('ETELEGRAM')
    );
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { requestsInLastSecond: number; config: TelegramRateLimitConfig } {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const requestsInLastSecond = this.requestTimes.filter(time => time > oneSecondAgo).length;

    return {
      requestsInLastSecond,
      config: this.config
    };
  }
}

export const telegramRateLimiter = new TelegramRateLimiter(); 