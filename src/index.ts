import { discordService } from '@/services/discord';
import { telegramService } from '@/services/telegram';
import { databaseService } from '@/services/database';
import { growthTrackingService } from '@/services/growth'; // 🛡️ SAFE: New optional service
import { server } from '@/server';
import { logger } from '@/utils/logger';
import { botConfig } from '@/config/bot';
import cron from 'node-cron';

class BotApplication {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private telegramEnabled: boolean = false;

  async start(): Promise<void> {
    try {
      logger.info('Starting BioDAO Multi-Platform Bot...');

      // Initialize database connection
      logger.info('Initializing database connection...');
      await databaseService.initialize();

      // Start Discord bot
      logger.info('Starting Discord bot...');
      await discordService.start();

      // Start Telegram bot if enabled
      this.telegramEnabled = !!botConfig.telegram.token;
      if (this.telegramEnabled) {
        logger.info('Starting Telegram bot...');
        await telegramService.start();
      } else {
        logger.info('Telegram bot is disabled (no token provided)');
      }

      // Start HTTP server
      logger.info('Starting HTTP server...');
      const port = parseInt(process.env['PORT'] || '3000');
      server.start(port);

      // Setup cleanup job
      this.setupCleanupJob();

      // 🛡️ SAFE: Initialize growth tracking (only if enabled via env var)
      try {
        await growthTrackingService.initialize();
      } catch (error) {
        logger.warn('Growth tracking initialization failed (non-critical):', error);
        // Don't let this break the main application
      }

      logger.info('✅ BioDAO Multi-Platform Bot started successfully!');
      logger.info(`📊 Discord: Monitoring ${botConfig.categories.length} categories`);
      if (this.telegramEnabled) {
        logger.info(`📱 Telegram: Monitoring ${telegramService.getChatConfigs().length} chats`);
      }
      logger.info(`🌐 HTTP server running on port ${port}`);
      
      // Log Discord category configurations
      botConfig.categories.forEach(category => {
        logger.info(`📁 Discord category: ${category.name} (${category.id}) - ${category.message_category} - ${category.tge_phase}`);
      });

      // Log Telegram chat configurations
      if (this.telegramEnabled) {
        const telegramChats = telegramService.getChatConfigs();
        telegramChats.forEach(chat => {
          logger.info(`📱 Telegram chat: ${chat.title} (${chat.id}) - ${chat.type} - ${chat.category}`);
        });
      }

      // Log discovered Discord channels after a short delay to allow discovery to complete
      setTimeout(() => {
        const channelConfigs = discordService.getChannelConfigs();
        logger.info(`🔍 Discovered ${channelConfigs.length} Discord channels across monitored categories`);
        
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
        // Cleanup Discord messages
        const discordResult = await databaseService.cleanupOldMessages();
        if (discordResult.success) {
          logger.info(`Discord cleanup completed: ${discordResult.data?.deleted_count || 0} messages deleted`);
        } else {
          logger.error(`Discord cleanup failed: ${discordResult.error}`);
        }

        // Cleanup Telegram messages if enabled
        if (this.telegramEnabled) {
          const telegramResult = await databaseService.cleanupOldTelegramMessages();
          if (telegramResult.success) {
            logger.info(`Telegram cleanup completed: ${telegramResult.data?.deleted_count || 0} messages deleted`);
          } else {
            logger.error(`Telegram cleanup failed: ${telegramResult.error}`);
          }
        }
      } catch (error) {
        logger.error('Cleanup job failed:', error);
      }
    });

    // Refresh configurations every hour
    cron.schedule('* * * * *', async () => {
      logger.info('Running scheduled configuration refresh...');
      try {
        // Refresh Discord configurations
        if (discordService.isReady()) {
          const beforeCount = discordService.getChannelConfigs().length;
          await discordService.refreshChannelConfigurations();
          const afterCount = discordService.getChannelConfigs().length;
          
          if (beforeCount !== afterCount) {
            logger.info(`Discord configuration updated: ${beforeCount} → ${afterCount} channels`);
          }
        }

        // Refresh Telegram configurations if enabled
        if (this.telegramEnabled && telegramService.isReady()) {
          const beforeCount = telegramService.getChatConfigs().length;
          await telegramService.refreshChatConfigurations();
          const afterCount = telegramService.getChatConfigs().length;
          
          if (beforeCount !== afterCount) {
            logger.info(`Telegram configuration updated: ${beforeCount} → ${afterCount} chats`);
          }
        }
      } catch (error) {
        logger.error('Configuration refresh job failed:', error);
      }
    });

    // Setup health check interval
    this.cleanupInterval = setInterval(async () => {
      try {
        const dbHealth = await databaseService.getHealthStatus();
        const discordReady = discordService.isReady();
        const telegramReady = this.telegramEnabled ? telegramService.isReady() : true;
        
        if (!dbHealth.success) {
          logger.warn('Database health check failed:', dbHealth.error);
        }
        
        if (!discordReady) {
          logger.warn('Discord bot is not ready');
        }

        if (this.telegramEnabled && !telegramReady) {
          logger.warn('Telegram bot is not ready');
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, botConfig.health.checkInterval);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down BioDAO Multi-Platform Bot...');

    try {
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // 🛡️ SAFE: Stop growth tracking service
      try {
        await growthTrackingService.shutdown();
      } catch (error) {
        logger.warn('Error stopping growth tracking service (non-critical):', error);
      }

      // Stop Discord bot
      await discordService.stop();

      // Stop Telegram bot if enabled
      if (this.telegramEnabled) {
        await telegramService.stop();
      }
      
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