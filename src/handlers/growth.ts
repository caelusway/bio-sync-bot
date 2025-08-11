// BioProtocol Growth Tracking API Handlers
// 🛡️ PRODUCTION SAFE: New endpoints that don't affect existing functionality

import { Request, Response } from 'express';
import { growthTrackingService } from '@/services/growth';
import { PlatformType, MetricType } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Get marketing dashboard data
 * GET /api/growth/dashboard
 */
export async function getMarketingDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const result = await growthTrackingService.getMarketingDashboard();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error in getMarketingDashboard handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get growth summary for a specific platform
 * GET /api/growth/platform/:platform
 */
export async function getPlatformGrowth(req: Request, res: Response): Promise<void> {
  try {
    const platform = req.params['platform'] as PlatformType;
    
    // Validate platform parameter
    if (!Object.values(PlatformType).includes(platform)) {
      res.status(400).json({
        success: false,
        error: `Invalid platform: ${platform}. Valid platforms: ${Object.values(PlatformType).join(', ')}`,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const result = await growthTrackingService.getPlatformGrowthSummary(platform);
    
    if (result.success) {
      res.json({
        success: true,
        platform,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error in getPlatformGrowth handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Manually trigger data collection for all platforms or specific platform
 * POST /api/growth/collect
 * POST /api/growth/collect/:platform
 */
export async function triggerDataCollection(req: Request, res: Response): Promise<void> {
  try {
    const platform = req.params['platform'] as PlatformType | undefined;
    
    // Validate platform parameter if provided
    if (platform && !Object.values(PlatformType).includes(platform)) {
      res.status(400).json({
        success: false,
        error: `Invalid platform: ${platform}. Valid platforms: ${Object.values(PlatformType).join(', ')}`,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    logger.info(`📊 Manual data collection triggered${platform ? ` for ${platform}` : ' for all platforms'}`);
    
    const results = await growthTrackingService.triggerManualCollection(platform);
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    res.json({
      success: true,
      message: `Data collection completed: ${successCount}/${totalCount} platforms successful`,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in triggerDataCollection handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get growth tracking service status
 * GET /api/growth/status
 */
export async function getGrowthStatus(_req: Request, res: Response): Promise<void> {
  try {
    const isRunning = growthTrackingService.isRunning();
    const activeCollections = growthTrackingService.getActiveCollections();
    const collectionCount = growthTrackingService.getCollectionCount();
    
    res.json({
      success: true,
      data: {
        service_running: isRunning,
        active_collections: activeCollections,
        collection_count: collectionCount,
        available_platforms: Object.values(PlatformType),
        available_metrics: Object.values(MetricType),
        status: isRunning ? 'active' : 'inactive'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in getGrowthStatus handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get latest growth metrics (quick overview)
 * GET /api/growth/metrics/latest
 */
export async function getLatestMetrics(_req: Request, res: Response): Promise<void> {
  try {
    const result = await growthTrackingService.getMarketingDashboard();
    
    if (result.success) {
      // Transform data for quick overview
      const summary = (result.data || []).reduce((acc: any, item: any) => {
        if (!acc[item.platform]) {
          acc[item.platform] = {};
        }
        acc[item.platform][item.metric_type] = {
          current_value: item.current_value,
          change_1d: item.change_1d,
          change_7d: item.change_7d,
          change_30d: item.change_30d,
          trend_1d: item.trend_1d,
          trend_7d: item.trend_7d,
          trend_30d: item.trend_30d
        };
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error in getLatestMetrics handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get growth metrics for charting
 * GET /api/growth/metrics/chart?platform=discord&metric=discord_message_count&period=30d
 */
export async function getMetricsForChart(req: Request, res: Response): Promise<void> {
  try {
    const { platform, metric, period = '30d' } = req.query;
    
    if (!platform || !metric) {
      res.status(400).json({
        success: false,
        error: 'platform and metric parameters are required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Validate parameters
    if (!Object.values(PlatformType).includes(platform as PlatformType)) {
      res.status(400).json({
        success: false,
        error: `Invalid platform: ${platform}`,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (!Object.values(MetricType).includes(metric as MetricType)) {
      res.status(400).json({
        success: false,
        error: `Invalid metric: ${metric}`,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // TODO: Implement historical chart data retrieval
    // For now, return placeholder structure
    res.json({
      success: true,
      data: {
        platform,
        metric,
        period,
        chart_data: [],
        message: 'Chart data endpoint not yet implemented - placeholder response'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in getMetricsForChart handler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}