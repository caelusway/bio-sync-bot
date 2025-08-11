#!/usr/bin/env node
// BioProtocol Growth Data Collector
// Standalone script for collecting growth metrics from all platforms

import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PlatformType, MetricType } from './types';
import { createLogger, format, transports } from 'winston';

// Load environment variables
dotenv.config();

// Setup logger
const logger = createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: format.combine(
    format.timestamp(),
    format.colorize(),
    format.simple()
  ),
  transports: [
    new transports.Console()
  ]
});

class GrowthCollector {
  private isRunning: boolean = false;
  private supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_ANON_KEY'];
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting BioProtocol Growth Collector...');
      
      // Test database connection
      const { error } = await this.supabase.from('growth_metrics').select('count', { count: 'exact', head: true });
      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }
      logger.info('✅ Database connection established');

      this.isRunning = true;
      
      // Run initial collection
      await this.runCollection();
      
      // Set up collection intervals
      await this.setupCollectionSchedule();
      
      logger.info('🎯 Growth Collector is now running. Press Ctrl+C to stop.');
      
    } catch (error) {
      logger.error('❌ Failed to start Growth Collector:', error);
      process.exit(1);
    }
  }

  private async runCollection(): Promise<void> {
    logger.info('📊 Starting growth metrics collection...');
    
    try {
      const results = await Promise.allSettled([
        this.collectYouTubeMetrics(),
        this.collectDiscordMetrics(),
        this.collectTelegramMetrics(),
        this.collectLinkedInMetrics(),
        this.collectLumaMetrics(),
        this.collectEmailMetrics()
      ]);

      let successCount = 0;
      results.forEach((result, index) => {
        const platforms = ['YouTube', 'Discord', 'Telegram', 'LinkedIn', 'Luma', 'Email'];
        if (result.status === 'fulfilled') {
          successCount++;
          logger.info(`✅ ${platforms[index]} collection completed`);
        } else {
          logger.error(`❌ ${platforms[index]} collection failed:`, result.reason);
        }
      });

      // Calculate analytics after collection
      await this.calculateAllAnalytics();
      
      logger.info(`📈 Collection round completed: ${successCount}/${results.length} platforms successful`);
      
    } catch (error) {
      logger.error('Error in collection round:', error);
    }
  }

  private async collectYouTubeMetrics(): Promise<void> {
    const apiKey = process.env['YOUTUBE_API_KEY'];
    const channelId = process.env['YOUTUBE_CHANNEL_ID'];

    if (!apiKey || !channelId) {
      logger.warn('YouTube API credentials missing, skipping...');
      return;
    }

    try {
      logger.debug('Collecting YouTube metrics...');
      
      // Fetch channel statistics
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        items?: Array<{
          statistics: {
            viewCount?: string;
            subscriberCount?: string;
            videoCount?: string;
          };
        }>;
      };
      
      if (!data.items || data.items.length === 0) {
        throw new Error('No channel data found');
      }

      const stats = data.items[0]?.statistics;
      const timestamp = new Date().toISOString();

      if (!stats) {
        throw new Error('No statistics data found');
      }

      // Save metrics
      await this.saveMetric(PlatformType.YOUTUBE, MetricType.YOUTUBE_TOTAL_VIEWS, 
        parseInt(stats.viewCount || '0'), timestamp, { source: 'youtube_api' });
      
      // Note: subscriber count might be hidden, handle gracefully
      if (stats.subscriberCount) {
        await this.saveMetric(PlatformType.YOUTUBE, MetricType.YOUTUBE_TOTAL_IMPRESSIONS, 
          parseInt(stats.subscriberCount || '0'), timestamp, { source: 'youtube_api', note: 'Using subscriber count as proxy' });
      }

      logger.info(`📺 YouTube: ${stats.viewCount} views, ${stats.subscriberCount || 'hidden'} subscribers`);

    } catch (error) {
      logger.error('YouTube collection failed:', error);
      throw error;
    }
  }

  private async collectDiscordMetrics(): Promise<void> {
    // For now, placeholder - can implement Discord API calls later
    logger.debug('Discord metrics collection not implemented yet');
    
    await this.saveMetric(PlatformType.DISCORD, MetricType.DISCORD_MESSAGE_COUNT, 
      0, new Date().toISOString(), { status: 'not_implemented' });
    await this.saveMetric(PlatformType.DISCORD, MetricType.DISCORD_MEMBER_COUNT, 
      0, new Date().toISOString(), { status: 'not_implemented' });
  }

  private async collectTelegramMetrics(): Promise<void> {
    // For now, placeholder - can implement Telegram API calls later
    logger.debug('Telegram metrics collection not implemented yet');
    
    await this.saveMetric(PlatformType.TELEGRAM, MetricType.TELEGRAM_MESSAGE_COUNT, 
      0, new Date().toISOString(), { status: 'not_implemented' });
    await this.saveMetric(PlatformType.TELEGRAM, MetricType.TELEGRAM_MEMBER_COUNT, 
      0, new Date().toISOString(), { status: 'not_implemented' });
  }

  private async collectLinkedInMetrics(): Promise<void> {
    logger.debug('LinkedIn metrics collection not implemented yet');
    
    await this.saveMetric(PlatformType.LINKEDIN, MetricType.LINKEDIN_FOLLOWER_COUNT, 
      0, new Date().toISOString(), { status: 'not_implemented' });
  }

  private async collectLumaMetrics(): Promise<void> {
    const airtableApiKey = process.env['AIRTABLE_API_KEY'];
    const airtableBaseId = process.env['AIRTABLE_BASE_ID'];
    const lumaTableName = process.env['LUMA_AIRTABLE_TABLE_NAME'];

    if (!airtableApiKey || !airtableBaseId || !lumaTableName) {
      logger.warn('Airtable credentials for Luma missing, skipping...');
      return;
    }

    try {
      logger.debug('Collecting Luma metrics from Airtable (with pagination)...');
      
      // Fetch all subscriber data from Airtable with pagination
      let allRecords: Array<{
        id: string;
        fields: Record<string, any>;
        createdTime: string;
      }> = [];
      
      let offset: string | undefined;
      let pageCount = 0;

      do {
        const url = new URL(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(lumaTableName)}`);
        if (offset) {
          url.searchParams.set('offset', offset);
        }

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${airtableApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
          records?: Array<{
            id: string;
            fields: Record<string, any>;
            createdTime: string;
          }>;
          offset?: string;
        };

        if (!data.records) {
          break;
        }

        allRecords.push(...data.records);
        offset = data.offset;
        pageCount++;
        
        logger.debug(`Fetched page ${pageCount}: ${data.records.length} records (total so far: ${allRecords.length})`);

        // Add a small delay to respect rate limits
        if (offset) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } while (offset);

      if (allRecords.length === 0) {
        throw new Error('No records found in Airtable');
      }

      const timestamp = new Date().toISOString();
      const subscriberCount = allRecords.length;

      // Extract additional metadata from records if available
      const activeSubscribers = allRecords.filter(record => 
        !record.fields['Unsubscribed'] && !record.fields['Inactive']
      ).length;

      // Count subscribers by status for better insights
      const statusCounts = allRecords.reduce((acc, record) => {
        const status = record.fields['Status'] || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Save subscriber count metric
      await this.saveMetric(PlatformType.LUMA, MetricType.LUMA_SUBSCRIBER_COUNT, 
        subscriberCount, timestamp, { 
          source: 'airtable', 
          note: 'Total subscribers tracked in Airtable (all pages)',
          airtable_base_id: airtableBaseId,
          table_name: lumaTableName,
          active_subscribers: activeSubscribers,
          pages_fetched: pageCount,
          status_breakdown: statusCounts
        });

      // Use active subscribers as page views proxy (people actively engaging)
      await this.saveMetric(PlatformType.LUMA, MetricType.LUMA_PAGE_VIEWS, 
        activeSubscribers, timestamp, { 
          source: 'airtable', 
          note: 'Active subscribers as engagement proxy',
          airtable_base_id: airtableBaseId,
          table_name: lumaTableName,
          total_subscribers: subscriberCount,
          pages_fetched: pageCount
        });

      logger.info(`🎪 Luma (Airtable): ${subscriberCount} total subscribers, ${activeSubscribers} active subscribers (${pageCount} pages fetched)`);

    } catch (error) {
      logger.error('Luma (Airtable) collection failed:', error);
      throw error;
    }
  }

  private async collectEmailMetrics(): Promise<void> {
    const clientId = process.env['WEBFLOW_CLIENT_ID'];
    const clientSecret = process.env['WEBFLOW_CLIENT_SECRET'];
    const accessToken = process.env['WEBFLOW_ACCESS_TOKEN'];
    const siteId = process.env['WEBFLOW_SITE_ID'];
    const formId = process.env['WEBFLOW_FORM_ID'];

    if (!clientId || !clientSecret) {
      logger.warn('Webflow client credentials missing, skipping...');
      return;
    }

    try {
      logger.debug('Collecting Email newsletter metrics from Webflow...');

      // Step 1: Get access token if not provided
      let currentAccessToken = accessToken;
      if (!currentAccessToken) {
        logger.info('No Webflow access token found. You need to complete OAuth2 flow first.');
        logger.info(`Visit: https://webflow.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=sites:read forms:read`);
        
        await this.saveMetric(PlatformType.EMAIL_NEWSLETTER, MetricType.EMAIL_NEWSLETTER_SIGNUP_COUNT, 
          0, new Date().toISOString(), { 
            status: 'oauth_required', 
            note: 'Need to complete OAuth2 flow first',
            oauth_url: `https://webflow.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=sites:read forms:read`
          });
        return;
      }

      // Step 2: Get site info if siteId not provided
      let currentSiteId = siteId;
      if (!currentSiteId) {
        const sitesResponse = await fetch('https://api.webflow.com/v2/sites', {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!sitesResponse.ok) {
          throw new Error(`Webflow Sites API error: ${sitesResponse.status} ${sitesResponse.statusText}`);
        }

        const sitesData = await sitesResponse.json() as {
          sites?: Array<{
            id: string;
            displayName: string;
            shortName: string;
            domains: Array<{ url: string }>;
          }>;
        };

        if (!sitesData.sites || sitesData.sites.length === 0) {
          throw new Error('No Webflow sites found');
        }

        // Find the bio.xyz site
        const bioSite = sitesData.sites.find(site => 
          site.domains.some(domain => domain.url.includes('bio') || domain.url.includes('webflow'))
        );

        currentSiteId = bioSite?.id || sitesData.sites[0]?.id;
        logger.info(`Using Webflow site: ${bioSite?.displayName || sitesData.sites[0]?.displayName} (${currentSiteId})`);
      }

      // Step 3: Get forms for the site if formId not provided
      let currentFormId = formId;
      if (!currentFormId) {
        const formsResponse = await fetch(`https://api.webflow.com/v2/sites/${currentSiteId}/forms`, {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!formsResponse.ok) {
          throw new Error(`Webflow Forms API error: ${formsResponse.status} ${formsResponse.statusText}`);
        }

        const formsData = await formsResponse.json() as {
          forms?: Array<{
            id: string;
            displayName: string;
            fieldsCount: number;
          }>;
        };

        if (!formsData.forms || formsData.forms.length === 0) {
          throw new Error('No forms found on Webflow site');
        }

        // Use the first form (or find email signup form)
        const emailForm = formsData.forms.find(form => 
          form.displayName.toLowerCase().includes('email') || 
          form.displayName.toLowerCase().includes('newsletter') ||
          form.displayName.toLowerCase().includes('signup')
        );

        currentFormId = emailForm?.id || formsData.forms[0]?.id;
        logger.info(`Using Webflow form: ${emailForm?.displayName || formsData.forms[0]?.displayName} (${currentFormId})`);
      }

      // Step 4: Get form submissions
      const submissionsResponse = await fetch(`https://api.webflow.com/v2/sites/${currentSiteId}/forms/${currentFormId}/submissions`, {
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!submissionsResponse.ok) {
        throw new Error(`Webflow Submissions API error: ${submissionsResponse.status} ${submissionsResponse.statusText}`);
      }

      const submissionsData = await submissionsResponse.json() as {
        formSubmissions?: Array<{
          id: string;
          submittedOn: string;
          data: Record<string, any>;
        }>;
        pagination?: {
          total: number;
        };
      };

      const timestamp = new Date().toISOString();
      const submissionCount = submissionsData.pagination?.total || submissionsData.formSubmissions?.length || 0;

      // Save email newsletter signup count
      await this.saveMetric(PlatformType.EMAIL_NEWSLETTER, MetricType.EMAIL_NEWSLETTER_SIGNUP_COUNT, 
        submissionCount, timestamp, { 
          source: 'webflow_api', 
          note: 'Total form submissions from Webflow',
          site_id: currentSiteId,
          form_id: currentFormId,
          recent_submissions: submissionsData.formSubmissions?.length || 0
        });

      logger.info(`📧 Email Newsletter (Webflow): ${submissionCount} total signups`);

    } catch (error) {
      logger.error('Email newsletter (Webflow) collection failed:', error);
      
      // Save error state
      await this.saveMetric(PlatformType.EMAIL_NEWSLETTER, MetricType.EMAIL_NEWSLETTER_SIGNUP_COUNT, 
        0, new Date().toISOString(), { 
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          note: 'Webflow API integration failed'
        });
      
      throw error;
    }
  }

  private async saveMetric(platform: PlatformType, metricType: MetricType, value: number, timestamp: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('upsert_growth_metric', {
          p_platform: platform,
          p_metric_type: metricType,
          p_metric_value: value,
          p_metric_metadata: metadata,
          p_recorded_at: timestamp
        });

      if (error) {
        logger.error(`Failed to save ${platform} ${metricType}:`, error.message);
      }
    } catch (error) {
      logger.error(`Error saving ${platform} ${metricType}:`, error);
    }
  }

  private async calculateAllAnalytics(): Promise<void> {
    try {
      logger.debug('Calculating growth analytics...');
      
      const platforms = Object.values(PlatformType);
      const metrics = Object.values(MetricType);
      
      for (const platform of platforms) {
        for (const metric of metrics) {
          if (this.isMetricForPlatform(metric, platform)) {
            await this.supabase.rpc('calculate_growth_analytics', {
              p_platform: platform,
              p_metric_type: metric,
              p_calculation_date: new Date().toISOString()
            });
          }
        }
      }
      
      logger.debug('✅ Analytics calculation completed');
    } catch (error) {
      logger.error('Error calculating analytics:', error);
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

  private async setupCollectionSchedule(): Promise<void> {
    // YouTube - every 2 hours
    setInterval(async () => {
      logger.info('🔄 Scheduled YouTube collection...');
      try {
        await this.collectYouTubeMetrics();
        await this.calculateAllAnalytics();
      } catch (error) {
        logger.error('Scheduled YouTube collection failed:', error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours

    // Other platforms - every 4 hours (placeholder for when implemented)
    setInterval(async () => {
      logger.info('🔄 Scheduled collection for other platforms...');
      try {
        await Promise.allSettled([
          this.collectDiscordMetrics(),
          this.collectTelegramMetrics(),
          this.collectLinkedInMetrics(),
          this.collectLumaMetrics(),
          this.collectEmailMetrics()
        ]);
        await this.calculateAllAnalytics();
      } catch (error) {
        logger.error('Scheduled collection failed:', error);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    logger.info('⏰ Collection schedule set up (YouTube: 2h, Others: 4h)');
  }

  private async gracefulShutdown(): Promise<void> {
    if (!this.isRunning) return;
    
    logger.info('🛑 Graceful shutdown initiated...');
    this.isRunning = false;
    
    // Give time for any ongoing operations to complete
    setTimeout(() => {
      logger.info('✅ Growth Collector stopped');
      process.exit(0);
    }, 2000);
  }
}

// Run the collector if this script is executed directly
if (require.main === module) {
  const collector = new GrowthCollector();
  collector.start().catch((error) => {
    logger.error('Failed to start Growth Collector:', error);
    process.exit(1);
  });
}