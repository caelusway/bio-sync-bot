// BioProtocol Growth Tracking Service
// 🛡️ PRODUCTION SAFE: Completely separate from existing functionality
// This service handles growth metrics collection and analytics calculation

import { 
  PlatformType, 
  MetricType, 
  GrowthMetric, 
  GrowthAnalytics, 
  GrowthPlatformConfig, 
  GrowthCollectionResult,
  MarketingDashboardData,
  ServiceResponse 
} from '@/types';
import { databaseService } from './database';
import { logger } from '@/utils/logger';

export class GrowthTrackingService {
  private collectionIntervals: Map<PlatformType, NodeJS.Timeout> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Initialize but don't start automatically to preserve existing functionality
  }

  /**
   * Initialize growth tracking (optional - can be disabled via config)
   * 🛡️ SAFE: Only starts if explicitly enabled
   */
  async initialize(): Promise<void> {
    try {
      // Check if growth tracking is enabled via environment variable
      const growthTrackingEnabled = process.env['GROWTH_TRACKING_ENABLED'] === 'true';
      
      if (!growthTrackingEnabled) {
        logger.info('📊 Growth tracking is disabled (GROWTH_TRACKING_ENABLED not set to true)');
        return;
      }

      logger.info('📊 Initializing Growth Tracking Service...');
      
      // Load platform configurations
      const platformConfigs = await this.loadPlatformConfigurations();
      
      // Start collection schedules for enabled platforms
      for (const config of platformConfigs) {
        if (config.collection_enabled) {
          await this.scheduleDataCollection(config);
        }
      }
      
      this.isInitialized = true;
      logger.info('✅ Growth Tracking Service initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Growth Tracking Service:', error);
      // Don't throw - this should not break existing functionality
    }
  }

  /**
   * Stop all growth tracking activities
   * 🛡️ SAFE: Clean shutdown without affecting other services
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('📊 Shutting down Growth Tracking Service...');
      
      // Clear all collection intervals
      for (const [platform, interval] of this.collectionIntervals) {
        clearInterval(interval);
        logger.debug(`Stopped collection for ${platform}`);
      }
      
      this.collectionIntervals.clear();
      this.isInitialized = false;
      
      logger.info('✅ Growth Tracking Service shutdown complete');
    } catch (error) {
      logger.error('Error during Growth Tracking Service shutdown:', error);
    }
  }

  /**
   * Collect metrics from all enabled platforms
   * 🛡️ SAFE: Isolated data collection, no impact on existing services
   */
  async collectAllMetrics(): Promise<GrowthCollectionResult[]> {
    const results: GrowthCollectionResult[] = [];
    
    try {
      const platformConfigs = await this.loadPlatformConfigurations();
      
      for (const config of platformConfigs) {
        if (config.collection_enabled) {
          const result = await this.collectPlatformMetrics(config.platform);
          results.push(result);
        }
      }
      
      // Calculate analytics after collecting all metrics
      await this.calculateAllAnalytics();
      
    } catch (error) {
      logger.error('Error collecting metrics from all platforms:', error);
    }
    
    return results;
  }

  /**
   * Collect metrics for a specific platform
   */
  async collectPlatformMetrics(platform: PlatformType): Promise<GrowthCollectionResult> {
    const timestamp = new Date().toISOString();
    
    try {
      let metrics: Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }> = [];
      
      switch (platform) {
        case PlatformType.DISCORD:
          metrics = await this.collectDiscordMetrics();
          break;
          
        case PlatformType.TELEGRAM:
          metrics = await this.collectTelegramMetrics();
          break;
          
        case PlatformType.YOUTUBE:
          metrics = await this.collectYouTubeMetrics();
          break;
          
        case PlatformType.LINKEDIN:
          metrics = await this.collectLinkedInMetrics();
          break;
          
        case PlatformType.LUMA:
          metrics = await this.collectLumaMetrics();
          break;
          
        case PlatformType.EMAIL_NEWSLETTER:
          metrics = await this.collectEmailNewsletterMetrics();
          break;
          
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      
      // Store metrics in database
      for (const metric of metrics) {
        await this.saveGrowthMetric({
          platform,
          metric_type: metric.metric_type,
          metric_value: metric.value,
          metric_metadata: metric.metadata || {},
          recorded_at: timestamp
        });
      }
      
      // Update platform config with successful collection
      await this.updatePlatformCollectionStatus(platform, 'success');
      
      logger.info(`✅ Collected ${metrics.length} metrics from ${platform}`);
      
      return {
        platform,
        metrics_collected: metrics,
        collection_timestamp: timestamp,
        success: true
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to collect metrics from ${platform}:`, errorMessage);
      
      // Update platform config with error status
      await this.updatePlatformCollectionStatus(platform, 'error', errorMessage);
      
      return {
        platform,
        metrics_collected: [],
        collection_timestamp: timestamp,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Collect Discord metrics via Discord API (not from existing database)
   * 🛡️ SAFE: Requires Discord API integration to be implemented
   */
  private async collectDiscordMetrics(): Promise<Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }>> {
    // TODO: Implement Discord API integration for fresh metrics
    // This should call Discord API to get current server stats, not database
    logger.debug('Discord metrics collection via API not implemented yet - returning placeholder values');
    
    return [
      { 
        metric_type: MetricType.DISCORD_MESSAGE_COUNT, 
        value: 0, 
        metadata: { 
          status: 'api_not_implemented', 
          note: 'Requires Discord API integration for fresh server stats' 
        } 
      },
      { 
        metric_type: MetricType.DISCORD_MEMBER_COUNT, 
        value: 0, 
        metadata: { 
          status: 'api_not_implemented', 
          note: 'Requires Discord API integration for current member count' 
        } 
      }
    ];
  }

  /**
   * Collect Telegram metrics via Telegram API (not from existing database)
   * 🛡️ SAFE: Requires Telegram API integration to be implemented
   */
  private async collectTelegramMetrics(): Promise<Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }>> {
    // TODO: Implement Telegram API integration for fresh metrics
    // This should call Telegram API to get current chat stats, not database
    logger.debug('Telegram metrics collection via API not implemented yet - returning placeholder values');
    
    return [
      { 
        metric_type: MetricType.TELEGRAM_MESSAGE_COUNT, 
        value: 0, 
        metadata: { 
          status: 'api_not_implemented', 
          note: 'Requires Telegram API integration for fresh chat stats' 
        } 
      },
      { 
        metric_type: MetricType.TELEGRAM_MEMBER_COUNT, 
        value: 0, 
        metadata: { 
          status: 'api_not_implemented', 
          note: 'Requires Telegram API integration for current member count' 
        } 
      }
    ];
  }

  /**
   * Collect YouTube metrics (placeholder - requires API integration)
   */
  private async collectYouTubeMetrics(): Promise<Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }>> {
    // TODO: Implement YouTube API integration
    logger.debug('YouTube metrics collection not implemented yet - returning placeholder values');
    
    return [
      { metric_type: MetricType.YOUTUBE_TOTAL_VIEWS, value: 0, metadata: { status: 'not_implemented' } },
      { metric_type: MetricType.YOUTUBE_TOTAL_IMPRESSIONS, value: 0, metadata: { status: 'not_implemented' } },
      { metric_type: MetricType.YOUTUBE_TOP_VIDEO_VIEWS, value: 0, metadata: { status: 'not_implemented' } },
      { metric_type: MetricType.YOUTUBE_TOP_VIDEO_IMPRESSIONS, value: 0, metadata: { status: 'not_implemented' } }
    ];
  }

  /**
   * Collect LinkedIn metrics (placeholder - requires API integration)
   */
  private async collectLinkedInMetrics(): Promise<Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }>> {
    // TODO: Implement LinkedIn API integration
    logger.debug('LinkedIn metrics collection not implemented yet - returning placeholder values');
    
    return [
      { metric_type: MetricType.LINKEDIN_FOLLOWER_COUNT, value: 0, metadata: { status: 'not_implemented' } }
    ];
  }

  /**
   * Collect Luma metrics (placeholder - requires API integration)
   */
  private async collectLumaMetrics(): Promise<Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }>> {
    // TODO: Implement Luma API integration
    logger.debug('Luma metrics collection not implemented yet - returning placeholder values');
    
    return [
      { metric_type: MetricType.LUMA_PAGE_VIEWS, value: 0, metadata: { status: 'not_implemented' } },
      { metric_type: MetricType.LUMA_SUBSCRIBER_COUNT, value: 0, metadata: { status: 'not_implemented' } }
    ];
  }

  /**
   * Collect Email Newsletter metrics (placeholder - requires Webflow integration)
   */
  private async collectEmailNewsletterMetrics(): Promise<Array<{ metric_type: MetricType; value: number; metadata?: Record<string, any> }>> {
    // TODO: Implement Webflow API integration
    logger.debug('Email Newsletter metrics collection not implemented yet - returning placeholder values');
    
    return [
      { metric_type: MetricType.EMAIL_NEWSLETTER_SIGNUP_COUNT, value: 0, metadata: { status: 'not_implemented' } }
    ];
  }

  /**
   * Calculate analytics for all platforms and metrics
   */
  async calculateAllAnalytics(): Promise<void> {
    try {
      const platforms = Object.values(PlatformType);
      const metrics = Object.values(MetricType);
      
      for (const platform of platforms) {
        for (const metric of metrics) {
          // Only calculate analytics for metrics that belong to this platform
          if (this.isMetricForPlatform(metric, platform)) {
            await databaseService.calculateGrowthAnalytics(platform, metric);
          }
        }
      }
      
      logger.debug('✅ Analytics calculation completed for all platforms');
    } catch (error) {
      logger.error('Error calculating analytics:', error);
    }
  }

  /**
   * Get marketing dashboard data
   */
  async getMarketingDashboard(): Promise<ServiceResponse<MarketingDashboardData[]>> {
    try {
      return await databaseService.getMarketingDashboardData();
    } catch (error) {
      logger.error('Error getting marketing dashboard data:', error);
      return { success: false, error: 'Failed to retrieve marketing dashboard data' };
    }
  }

  /**
   * Get growth summary for specific platform
   */
  async getPlatformGrowthSummary(platform: PlatformType): Promise<ServiceResponse<GrowthAnalytics[]>> {
    try {
      return await databaseService.getPlatformGrowthAnalytics(platform);
    } catch (error) {
      logger.error(`Error getting growth summary for ${platform}:`, error);
      return { success: false, error: `Failed to retrieve growth summary for ${platform}` };
    }
  }

  /**
   * Manual trigger for data collection (useful for testing)
   */
  async triggerManualCollection(platform?: PlatformType): Promise<GrowthCollectionResult[]> {
    try {
      if (platform) {
        logger.info(`📊 Manual collection triggered for ${platform}`);
        const result = await this.collectPlatformMetrics(platform);
        await this.calculateAllAnalytics();
        return [result];
      } else {
        logger.info('📊 Manual collection triggered for all platforms');
        return await this.collectAllMetrics();
      }
    } catch (error) {
      logger.error('Error in manual collection trigger:', error);
      return [];
    }
  }

  // Private helper methods

  private async loadPlatformConfigurations(): Promise<GrowthPlatformConfig[]> {
    try {
      const result = await databaseService.getGrowthPlatformConfigs();
      return result.success ? (result.data || []) : [];
    } catch (error) {
      logger.error('Error loading platform configurations:', error);
      return [];
    }
  }

  private async scheduleDataCollection(config: GrowthPlatformConfig): Promise<void> {
    try {
      const intervalMs = config.collection_interval_minutes * 60 * 1000;
      
      const interval = setInterval(async () => {
        await this.collectPlatformMetrics(config.platform);
        await this.calculateAllAnalytics();
      }, intervalMs);
      
      this.collectionIntervals.set(config.platform, interval);
      
      logger.info(`📊 Scheduled data collection for ${config.platform} every ${config.collection_interval_minutes} minutes`);
    } catch (error) {
      logger.error(`Error scheduling collection for ${config.platform}:`, error);
    }
  }

  private async saveGrowthMetric(metricData: Omit<GrowthMetric, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    try {
      await databaseService.saveGrowthMetric(metricData);
    } catch (error) {
      logger.error('Error saving growth metric:', error);
    }
  }

  private async updatePlatformCollectionStatus(
    platform: PlatformType, 
    status: 'success' | 'error', 
    error?: string
  ): Promise<void> {
    try {
      await databaseService.updateGrowthPlatformCollectionStatus(platform, status, error);
    } catch (error) {
      logger.error(`Error updating collection status for ${platform}:`, error);
    }
  }

  private isMetricForPlatform(metric: MetricType, platform: PlatformType): boolean {
    const platformMetrics = {
      [PlatformType.DISCORD]: [MetricType.DISCORD_MESSAGE_COUNT, MetricType.DISCORD_MEMBER_COUNT],
      [PlatformType.TELEGRAM]: [MetricType.TELEGRAM_MESSAGE_COUNT, MetricType.TELEGRAM_MEMBER_COUNT],
      [PlatformType.YOUTUBE]: [
        MetricType.YOUTUBE_TOTAL_VIEWS,
        MetricType.YOUTUBE_TOTAL_IMPRESSIONS,
        MetricType.YOUTUBE_TOP_VIDEO_VIEWS,
        MetricType.YOUTUBE_TOP_VIDEO_IMPRESSIONS
      ],
      [PlatformType.LINKEDIN]: [MetricType.LINKEDIN_FOLLOWER_COUNT],
      [PlatformType.LUMA]: [MetricType.LUMA_PAGE_VIEWS, MetricType.LUMA_SUBSCRIBER_COUNT],
      [PlatformType.EMAIL_NEWSLETTER]: [MetricType.EMAIL_NEWSLETTER_SIGNUP_COUNT]
    };

    return platformMetrics[platform]?.includes(metric) ?? false;
  }

  // Public getters for status monitoring
  
  public isRunning(): boolean {
    return this.isInitialized;
  }

  public getActiveCollections(): PlatformType[] {
    return Array.from(this.collectionIntervals.keys());
  }

  public getCollectionCount(): number {
    return this.collectionIntervals.size;
  }
}

// Export singleton instance
export const growthTrackingService = new GrowthTrackingService();