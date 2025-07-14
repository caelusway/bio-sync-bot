import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { healthCheck, readinessCheck, livenessCheck } from '@/handlers/health';
import { botConfig } from '@/config/bot';
import { logger } from '@/utils/logger';
import { databaseService } from '@/services/database';
import { discordService } from '@/services/discord';
import { discordRateLimiter } from '@/utils/discordRateLimit';

export class Server {
  private app: express.Application;
  private rateLimiter: RateLimiterMemory;

  constructor() {
    this.app = express();
    this.rateLimiter = new RateLimiterMemory({
      keyPrefix: 'middleware',
      points: botConfig.rateLimiting.maxRequests,
      duration: botConfig.rateLimiting.windowMs / 1000,
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting middleware
    this.app.use(async (req, res, next) => {
      try {
        await this.rateLimiter.consume(req.ip || 'unknown');
        next();
      } catch (rejRes: any) {
        const secs = Math.round((rejRes as any).msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(secs));
        res.status(429).json({ error: 'Too Many Requests', retryAfter: secs });
      }
    });

    // Request logging middleware
    this.app.use((_req, _res, next) => {
      next();
    });
  }

  private setupRoutes(): void {
    // Health check routes
    this.app.get('/health', healthCheck);
    this.app.get('/health/readiness', readinessCheck);
    this.app.get('/health/liveness', livenessCheck);

    // Management routes
    this.app.post('/api/refresh-channels', async (_req, res) => {
      try {
        logger.info('Refreshing Discord channels configuration...');
        
        await discordService.refreshChannelConfigurations();
        
        res.json({ 
          success: true, 
          message: 'Channels refreshed successfully' 
        });
      } catch (error) {
        logger.error('Failed to refresh channels:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to refresh channels' 
        });
      }
    });

    // Configuration info routes
    this.app.get('/api/config/categories', async (_req, res) => {
      try {
        const categories = botConfig.categories;
        res.json(categories);
      } catch (error) {
        logger.error('Failed to get categories:', error);
        res.status(500).json({ error: 'Failed to get categories' });
      }
    });

    this.app.get('/api/config/channels', async (_req, res) => {
      try {
        const channels = botConfig.channels;
        res.json(channels);
      } catch (error) {
        logger.error('Failed to get channels:', error);
        res.status(500).json({ error: 'Failed to get channels' });
      }
    });

    // Statistics routes
    this.app.get('/api/stats/channels', async (_req, res) => {
      try {
        // For now, return empty array since we need channel IDs to get stats
        res.json([]);
      } catch (error) {
        logger.error('Failed to get channel stats:', error);
        res.status(500).json({ error: 'Failed to get channel stats' });
      }
    });

    this.app.get('/api/stats/categories', async (_req, res) => {
      try {
        // For now, return empty array since this method doesn't exist yet
        res.json([]);
      } catch (error) {
        logger.error('Failed to get category stats:', error);
        res.status(500).json({ error: 'Failed to get category stats' });
      }
    });

    // Data access routes
    this.app.get('/api/messages', async (req, res) => {
      try {
        const limit = parseInt(req.query['limit'] as string) || 100;
        const offset = parseInt(req.query['offset'] as string) || 0;
        const category = req.query['category'] as string;
        
        if (category) {
          const result = await databaseService.getMessagesByCategory(category, limit, offset);
          if (result.success) {
            res.json(result.data);
          } else {
            res.status(500).json({ error: result.error });
          }
        } else {
          // Return empty array if no category specified
          res.json([]);
        }
      } catch (error) {
        logger.error('Failed to get messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
      }
    });

    this.app.get('/api/users/activity', async (_req, res) => {
      try {
        // For now, return empty array since this method doesn't exist yet
        res.json([]);
      } catch (error) {
        logger.error('Failed to get user activity:', error);
        res.status(500).json({ error: 'Failed to get user activity' });
      }
    });

    // Discord Rate Limiting Status
    this.app.get('/api/rate-limit/status', async (_req, res) => {
      try {
        const status = discordRateLimiter.getRateLimitStatus();
        res.json({ 
          success: true, 
          status: status,
          message: 'Discord API rate limiting is active',
          info: {
            description: 'Rate limiting prevents Discord API ban',
            currentRequests: status.requestsInLastSecond,
            maxRequests: status.config.requestsPerSecond,
            utilizationPercent: Math.round((status.requestsInLastSecond / status.config.requestsPerSecond) * 100),
            safetyStatus: status.requestsInLastSecond < status.config.requestsPerSecond * 0.8 ? 'SAFE' : 'BUSY'
          }
        });
      } catch (error) {
        logger.error('Failed to get rate limit status:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to get rate limit status' 
        });
      }
    });

    // Thread verification routes
    this.app.get('/api/threads/verify', async (_req, res) => {
      try {
        logger.info('Thread storage verification requested via API');
        await discordService.verifyThreadStorage();
        
        res.json({ 
          success: true, 
          message: 'Thread storage verification completed - check logs for details' 
        });
      } catch (error) {
        logger.error('Failed to verify thread storage:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to verify thread storage' 
        });
      }
    });

    this.app.get('/api/threads/demo', async (_req, res) => {
      try {
        logger.info('Thread storage demonstration requested via API');
        await discordService.demonstrateThreadStorage();
        
        res.json({ 
          success: true, 
          message: 'Thread storage behavior demonstrated - check logs for details',
          behavior: {
            channel_name: 'Parent Channel Name (not thread name)',
            is_thread: true,
            thread_name: 'Actual thread name',
            parent_channel_id: 'Parent channel ID',
            parent_channel_name: 'Parent channel name',
            channel_id: 'Thread channel ID (for Discord API)',
            stats_aggregation: 'Statistics count towards parent channel',
            metadata: 'Enhanced metadata includes thread_info object'
          }
        });
      } catch (error) {
        logger.error('Failed to demonstrate thread storage:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to demonstrate thread storage' 
        });
      }
    });

    this.app.get('/api/threads/messages', async (req, res) => {
      try {
        const limit = parseInt(req.query['limit'] as string) || 10;
        const result = await databaseService.getThreadMessages(limit);
        
        if (result.success) {
          res.json({
            success: true,
            data: result.data,
            message: `Retrieved ${result.data?.length || 0} thread messages`,
            explanation: 'These are thread messages stored with parent channel names in the channel_name field'
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: result.error 
          });
        }
      } catch (error) {
        logger.error('Failed to get thread messages:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to get thread messages' 
        });
      }
    });

    this.app.get('/api/threads/verify-joining', async (_req, res) => {
      try {
        logger.info('Thread joining verification requested via API');
        await discordService.verifyThreadJoining();
        
        res.json({ 
          success: true, 
          message: 'Thread joining verification completed - check logs for details',
          note: 'This endpoint verifies if the bot has successfully joined all active threads to capture their messages'
        });
      } catch (error) {
        logger.error('Failed to verify thread joining:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to verify thread joining' 
        });
      }
    });

    this.app.get('/api/threads/test-processing', async (_req, res) => {
      try {
        logger.info('Thread message processing test requested via API');
        await discordService.testThreadMessageProcessing();
        
        res.json({ 
          success: true, 
          message: 'Thread message processing test completed - check logs for detailed analysis',
          note: 'This endpoint tests how thread messages would be processed and shows filter results'
        });
      } catch (error) {
        logger.error('Failed to test thread message processing:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to test thread message processing' 
        });
      }
    });

    this.app.get('/api/debug/categories', async (_req, res) => {
      try {
        logger.info('Category configurations debug requested via API');
        await discordService.debugCategoryConfigurations();
        
        res.json({ 
          success: true, 
          message: 'Category configurations debug completed - check logs for detailed configurations',
          note: 'This endpoint shows all category configurations. NOTE: Patterns only apply to channels, NOT threads.'
        });
      } catch (error) {
        logger.error('Failed to debug category configurations:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to debug category configurations' 
        });
      }
    });

    this.app.get('/api/debug/channels', async (_req, res) => {
      try {
        logger.info('All channels debug requested via API');
        await discordService.debugAllChannels();
        
        res.json({ 
          success: true, 
          message: 'All channels debug completed - check logs for detailed channel information',
          note: 'This endpoint shows all available channels and checks individual channel configurations. Supports both text channels and forum channels.'
        });
      } catch (error) {
        logger.error('Failed to debug all channels:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to debug all channels' 
        });
      }
    });

    this.app.post('/api/threads/force-join-all', async (_req, res) => {
      try {
        logger.info('Force join all threads requested via API');
        await discordService.forceJoinAllThreads();
        
        res.json({ 
          success: true, 
          message: 'Force join all threads completed - check logs for detailed results',
          note: 'This endpoint forces the bot to join ALL threads in monitored channels, regardless of patterns'
        });
      } catch (error) {
        logger.error('Failed to force join all threads:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to force join all threads' 
        });
      }
    });

    this.app.post('/api/backfill/historical-messages', async (_req, res) => {
      try {
        logger.info('Historical message backfill requested via API');
        await discordService.backfillHistoricalMessages();
        
        res.json({ 
          success: true, 
          message: 'Historical message backfill completed successfully. Check logs for detailed results.',
          note: 'This process fetches and stores historical messages from all tracked channels and threads/forum posts.'
        });
      } catch (error) {
        logger.error('Failed to backfill historical messages:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to backfill historical messages' 
        });
      }
    });

    // Home endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        name: 'BioDAO Discord Bot',
        version: '1.0.0',
        status: 'running',
        endpoints: [
          'GET /health',
          'GET /ready',
          'GET /live',
          'POST /api/refresh-channels',
          'GET /api/config/categories',
          'GET /api/config/channels',
          'GET /api/stats/channels',
          'GET /api/stats/categories',
          'GET /api/messages',
          'GET /api/users/activity',
          'GET /api/threads/verify',
          'GET /api/threads/demo',
          'GET /api/threads/messages',
          'GET /api/threads/verify-joining',
          'GET /api/threads/test-processing',
          'GET /api/debug/categories',
          'GET /api/debug/channels',
          'POST /api/threads/force-join-all',
          'POST /api/backfill/historical-messages'
        ],
        thread_storage_info: {
          description: 'Thread messages are stored with parent channel names',
          pattern_filtering: 'DISABLED for threads - all threads in monitored channels are processed',
          key_fields: {
            channel_name: 'Always the parent channel name for thread messages',
            is_thread: 'true for thread messages',
            thread_name: 'The actual thread name',
            parent_channel_id: 'ID of the parent channel',
            stats_aggregation: 'Thread stats count towards parent channel'
          },
          note: 'Include/exclude patterns only apply to channels, NOT threads'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env['NODE_ENV'] === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  public start(port: number = 3000): void {
    this.app.listen(port, () => {
      logger.info(`Server started on port ${port}`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

export const server = new Server();