import { discordService } from '@/services/discord';
import { databaseService } from '@/services/database';
import { server } from '@/server';
import { logger } from '@/utils/logger';
import { botConfig } from '@/config/bot';
import cron from 'node-cron';

class BotApplication {
  private cleanupInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    try {
      logger.info('Starting BioDAO Discord Bot...');

      // Initialize database connection
      logger.info('Initializing database connection...');
      await databaseService.initialize();

      // Start Discord bot
      logger.info('Starting Discord bot...');
      await discordService.start();

      // Start HTTP server
      logger.info('Starting HTTP server...');
      const port = parseInt(process.env['PORT'] || '3000');
      server.start(port);

      // Setup cleanup job
      this.setupCleanupJob();

      logger.info('✅ BioDAO Discord Bot started successfully!');
      logger.info(`📊 Monitoring ${botConfig.categories.length} categories`);
      logger.info(`🌐 HTTP server running on port ${port}`);
      
      // Log category configurations
      botConfig.categories.forEach(category => {
        logger.info(`📁 Monitoring category: ${category.name} (${category.id}) - ${category.message_category} - ${category.tge_phase}`);
      });

      // Log discovered channels after a short delay to allow discovery to complete
      setTimeout(() => {
        const channelConfigs = discordService.getChannelConfigs();
        logger.info(`🔍 Discovered ${channelConfigs.length} channels across monitored categories`);
        
        // Group channels by category for better logging
        const channelsByCategory = new Map();
        channelConfigs.forEach(channel => {
          if (!channelsByCategory.has(channel.category_name)) {
            channelsByCategory.set(channel.category_name, []);
          }
          channelsByCategory.get(channel.category_name).push(channel.name);
        });

        channelsByCategory.forEach((channels, categoryName) => {
          logger.info(`📁 ${categoryName}: ${channels.join(', ')}`);
        });
      }, 5000);

    } catch (error) {
      logger.error('Failed to start bot application:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private setupCleanupJob(): void {
    // Run cleanup every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled database cleanup...');
      try {
        const result = await databaseService.cleanupOldMessages();
        if (result.success) {
          logger.info(`Cleanup completed: ${result.data?.deleted_count || 0} messages deleted`);
        } else {
          logger.error(`Cleanup failed: ${result.error}`);
        }
      } catch (error) {
        logger.error('Cleanup job failed:', error);
      }
    });

    // Refresh channel configurations every hour to catch new channels
    cron.schedule('* * * * *', async () => {
      logger.info('Running scheduled channel configuration refresh...');
      try {
        if (discordService.isReady()) {
          const beforeCount = discordService.getChannelConfigs().length;
          await discordService.refreshChannelConfigurations();
          const afterCount = discordService.getChannelConfigs().length;
          
          if (beforeCount !== afterCount) {
            logger.info(`Channel configuration updated: ${beforeCount} → ${afterCount} channels`);
          } else {
            logger.debug('Channel configuration refresh completed - no changes');
          }
        }
      } catch (error) {
        logger.error('Channel refresh job failed:', error);
      }
    });

    // Setup health check interval
    this.cleanupInterval = setInterval(async () => {
      try {
        const dbHealth = await databaseService.getHealthStatus();
        const discordReady = discordService.isReady();
        
        if (!dbHealth.success) {
          logger.warn('Database health check failed:', dbHealth.error);
        }
        
        if (!discordReady) {
          logger.warn('Discord bot is not ready');
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, botConfig.health.checkInterval);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down BioDAO Discord Bot...');

    try {
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Stop Discord bot
      await discordService.stop();
      
      logger.info('✅ Bot shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Create bot instance
const bot = new BotApplication();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await bot.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
bot.start().catch(error => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
}); 