import TelegramBot from 'node-telegram-bot-api';
import { TelegramMessage, TelegramChatConfig, TelegramMessageCategory, TelegramAttachment } from '@/types';
import { databaseService } from './database';
import { logger } from '@/utils/logger';
import { telegramRateLimiter } from '@/utils/telegramRateLimit';

export class TelegramService {
  private bot: TelegramBot;
  private chatConfigs: Map<string, TelegramChatConfig>;
  private isStarted: boolean = false;

  constructor() {
    if (!process.env['TELEGRAM_BOT_TOKEN']) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    // Create bot instance WITHOUT polling - we'll start polling in start() method
    this.bot = new TelegramBot(process.env['TELEGRAM_BOT_TOKEN'], {
      polling: false
    });
    
    this.chatConfigs = new Map();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.bot.on('message', async (message) => {
      await this.handleMessage(message);
    });

    this.bot.on('edited_message', async (message) => {
      await this.handleMessageUpdate(message);
    });

    this.bot.on('channel_post', async (message) => {
      await this.handleMessage(message);
    });

    this.bot.on('edited_channel_post', async (message) => {
      await this.handleMessageUpdate(message);
    });

    this.bot.on('callback_query', async (query) => {
      logger.debug('Received callback query:', query);
    });

    this.bot.on('error', (error) => {
      logger.error('Telegram bot error:', error);
    });

    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error:', error);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Telegram bot...');
      
      // Get bot info
      const botInfo = await telegramRateLimiter.executeWithRetry(
        () => this.bot.getMe(),
        'get bot info'
      );
      
      logger.info(`Telegram bot logged in as ${botInfo.username} (${botInfo.first_name})`);

      // Initialize chat configurations
      await this.initializeChatConfigurations();

      // Start polling for updates
      await this.bot.startPolling();
      
      this.isStarted = true;
      logger.info('Telegram bot started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }
  

  async stop(): Promise<void> {
    try {
      if (this.isStarted) {
        await this.bot.stopPolling();
        this.isStarted = false;
        logger.info('Telegram bot stopped successfully');
      }
    } catch (error) {
      logger.error('Failed to stop Telegram bot:', error);
      throw error;
    }
  }

  private async initializeChatConfigurations(): Promise<void> {
    try {
      logger.info('🔍 Initializing Telegram chat configurations...');
      
      // Get updates to discover active chats
      const updates = await telegramRateLimiter.executeWithRetry(
        () => this.bot.getUpdates({ limit: 100 }),
        'get updates for chat discovery'
      );

      const discoveredChats = new Set<string>();

      // Process updates to find chats
      for (const update of updates) {
        const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
        if (message && message.chat) {
          discoveredChats.add(message.chat.id.toString());
          
          const chatConfig = this.createChatConfig(message.chat);
          this.chatConfigs.set(message.chat.id.toString(), chatConfig);
        }
      }

      logger.info(`✅ Discovered ${discoveredChats.size} active chats`);
      
      // Log discovered chats
      for (const [chatId, config] of this.chatConfigs) {
        logger.info(`📱 Monitoring chat: ${config.title} (${chatId}) - ${config.type} - ${config.category}`);
      }

    } catch (error) {
      logger.error('Failed to initialize chat configurations:', error);
      throw error;
    }
  }

  private createChatConfig(chat: TelegramBot.Chat): TelegramChatConfig {
    let category: TelegramMessageCategory;
    
    switch (chat.type) {
      case 'group':
      case 'supergroup':
        category = TelegramMessageCategory.GROUP;
        break;
      case 'channel':
        category = TelegramMessageCategory.CHANNEL;
        break;
      case 'private':
        category = TelegramMessageCategory.PRIVATE;
        break;
      default:
        category = TelegramMessageCategory.GROUP;
    }

    return {
      id: chat.id.toString(),
      title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim() || 'Unknown',
      type: chat.type,
      category,
      monitoring_enabled: true,
      filters: []
    };
  }

  private async handleMessage(message: TelegramBot.Message): Promise<void> {
    try {
      if (!message.from || !message.chat) {
        logger.debug('Skipping message without from or chat info');
        return;
      }

      // Skip bot messages
      if (message.from.is_bot) {
        logger.debug('Skipping bot message');
        return;
      }

      // Update chat config if needed
      const chatId = message.chat.id.toString();
      if (!this.chatConfigs.has(chatId)) {
        const chatConfig = this.createChatConfig(message.chat);
        this.chatConfigs.set(chatId, chatConfig);
        logger.info(`📱 New chat discovered: ${chatConfig.title} (${chatId}) - ${chatConfig.type}`);
      }

      const chatConfig = this.chatConfigs.get(chatId);
      if (!chatConfig || !chatConfig.monitoring_enabled) {
        logger.debug(`Skipping message from disabled chat: ${chatId}`);
        return;
      }

      // Convert to TelegramMessage
      const telegramMessage = await this.convertToTelegramMessage(message, chatConfig);

      // Save to database
      const result = await databaseService.saveTelegramMessage(telegramMessage);
      if (result.success) {
        logger.debug(`✅ Telegram message saved: ${message.message_id} in ${chatConfig.title}`);
      } else {
        logger.error(`❌ Failed to save Telegram message: ${result.error}`);
      }

      // Update chat and user statistics
      await this.updateChatStats(message, chatConfig);
      await this.updateUserActivity(message, chatConfig);

    } catch (error) {
      logger.error('Error handling Telegram message:', error);
    }
  }

  private async handleMessageUpdate(message: TelegramBot.Message): Promise<void> {
    try {
      if (!message.from || !message.chat) {
        logger.debug('Skipping message update without from or chat info');
        return;
      }

      const chatId = message.chat.id.toString();
      const chatConfig = this.chatConfigs.get(chatId);
      
      if (!chatConfig || !chatConfig.monitoring_enabled) {
        logger.debug(`Skipping message update from disabled chat: ${chatId}`);
        return;
      }

      // Convert to TelegramMessage
      const telegramMessage = await this.convertToTelegramMessage(message, chatConfig);

      // Update in database
      const result = await databaseService.updateTelegramMessage(message.message_id.toString(), {
        content: telegramMessage.content || '',
        attachments: telegramMessage.attachments,
        edited_timestamp: new Date().toISOString(),
        metadata: telegramMessage.metadata
      });

      if (result.success) {
        logger.debug(`✅ Telegram message updated: ${message.message_id} in ${chatConfig.title}`);
      } else {
        logger.error(`❌ Failed to update Telegram message: ${result.error}`);
      }

    } catch (error) {
      logger.error('Error handling Telegram message update:', error);
    }
  }

  private async convertToTelegramMessage(
    message: TelegramBot.Message,
    chatConfig: TelegramChatConfig
  ): Promise<Omit<TelegramMessage, 'created_at' | 'updated_at'>> {
    const attachments: TelegramAttachment[] = [];

    // Helper function to create clean thumb object without undefined values
    const createThumb = (thumbData: any) => {
      if (!thumbData) return undefined;
      
      const thumb: any = {
        file_id: thumbData.file_id,
        file_unique_id: thumbData.file_unique_id,
        width: thumbData.width,
        height: thumbData.height
      };
      
      if (thumbData.file_size !== undefined) {
        thumb.file_size = thumbData.file_size;
      }
      
      return thumb;
    };

    // Helper function to create attachment with only defined properties
    const createAttachment = (base: any): TelegramAttachment => {
      const attachment: any = {
        type: base.type,
        file_id: base.file_id,
        file_unique_id: base.file_unique_id
      };
      
      if (base.file_size !== undefined) attachment.file_size = base.file_size;
      if (base.file_name !== undefined) attachment.file_name = base.file_name;
      if (base.mime_type !== undefined) attachment.mime_type = base.mime_type;
      if (base.width !== undefined) attachment.width = base.width;
      if (base.height !== undefined) attachment.height = base.height;
      if (base.duration !== undefined) attachment.duration = base.duration;
      if (base.thumb !== undefined) attachment.thumb = base.thumb;
      
      return attachment as TelegramAttachment;
    };

    // Process different types of attachments
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      if (largestPhoto) {
        const photoData: any = {
          type: 'photo',
          file_id: largestPhoto.file_id,
          file_unique_id: largestPhoto.file_unique_id,
          width: largestPhoto.width,
          height: largestPhoto.height
        };
        
        if (largestPhoto.file_size !== undefined) {
          photoData.file_size = largestPhoto.file_size;
        }
        
        attachments.push(createAttachment(photoData));
      }
    }

    if (message.video) {
      const thumb = createThumb(message.video.thumb);
      
      const videoData: any = {
        type: 'video',
        file_id: message.video.file_id,
        file_unique_id: message.video.file_unique_id,
        width: message.video.width,
        height: message.video.height,
        duration: message.video.duration
      };
      
      if (message.video.file_size !== undefined) videoData.file_size = message.video.file_size;
      if ((message.video as any).file_name !== undefined) videoData.file_name = (message.video as any).file_name;
      if (message.video.mime_type !== undefined) videoData.mime_type = message.video.mime_type;
      if (thumb !== undefined) videoData.thumb = thumb;

      attachments.push(createAttachment(videoData));
    }

    if (message.document) {
      const thumb = createThumb(message.document.thumb);
      
      const documentData: any = {
        type: 'document',
        file_id: message.document.file_id,
        file_unique_id: message.document.file_unique_id
      };
      
      if (message.document.file_size !== undefined) documentData.file_size = message.document.file_size;
      if (message.document.file_name !== undefined) documentData.file_name = message.document.file_name;
      if (message.document.mime_type !== undefined) documentData.mime_type = message.document.mime_type;
      if (thumb !== undefined) documentData.thumb = thumb;

      attachments.push(createAttachment(documentData));
    }

    if (message.audio) {
      const audioData: any = {
        type: 'audio',
        file_id: message.audio.file_id,
        file_unique_id: message.audio.file_unique_id,
        duration: message.audio.duration
      };
      
      if (message.audio.file_size !== undefined) audioData.file_size = message.audio.file_size;
      if ((message.audio as any).file_name !== undefined) audioData.file_name = (message.audio as any).file_name;
      if (message.audio.mime_type !== undefined) audioData.mime_type = message.audio.mime_type;

      attachments.push(createAttachment(audioData));
    }

    if (message.voice) {
      const voiceData: any = {
        type: 'voice',
        file_id: message.voice.file_id,
        file_unique_id: message.voice.file_unique_id,
        duration: message.voice.duration
      };
      
      if (message.voice.file_size !== undefined) voiceData.file_size = message.voice.file_size;
      if (message.voice.mime_type !== undefined) voiceData.mime_type = message.voice.mime_type;

      attachments.push(createAttachment(voiceData));
    }

    if (message.sticker) {
      const thumb = createThumb((message.sticker as any).thumb);
      
      const stickerData: any = {
        type: 'sticker',
        file_id: message.sticker.file_id,
        file_unique_id: message.sticker.file_unique_id,
        width: message.sticker.width,
        height: message.sticker.height
      };
      
      if (message.sticker.file_size !== undefined) stickerData.file_size = message.sticker.file_size;
      if (thumb !== undefined) stickerData.thumb = thumb;

      attachments.push(createAttachment(stickerData));
    }

    if (message.animation) {
      const thumb = createThumb(message.animation.thumb);
      
      const animationData: any = {
        type: 'animation',
        file_id: message.animation.file_id,
        file_unique_id: message.animation.file_unique_id,
        width: message.animation.width,
        height: message.animation.height,
        duration: message.animation.duration
      };
      
      if (message.animation.file_size !== undefined) animationData.file_size = message.animation.file_size;
      if (message.animation.file_name !== undefined) animationData.file_name = message.animation.file_name;
      if (message.animation.mime_type !== undefined) animationData.mime_type = message.animation.mime_type;
      if (thumb !== undefined) animationData.thumb = thumb;

      attachments.push(createAttachment(animationData));
    }

    if (message.video_note) {
      const thumb = createThumb(message.video_note.thumb);
      
      const videoNoteData: any = {
        type: 'video_note',
        file_id: message.video_note.file_id,
        file_unique_id: message.video_note.file_unique_id,
        duration: message.video_note.duration
      };
      
      if (message.video_note.file_size !== undefined) videoNoteData.file_size = message.video_note.file_size;
      if (thumb !== undefined) videoNoteData.thumb = thumb;

      attachments.push(createAttachment(videoNoteData));
    }

    // Build metadata
    const metadata: Record<string, any> = {};
    if (message['caption']) metadata['caption'] = message['caption'];
    if (message['entities']) metadata['entities'] = message['entities'];
    if (message['caption_entities']) metadata['caption_entities'] = message['caption_entities'];

    const telegramMessage: Omit<TelegramMessage, 'created_at' | 'updated_at'> = {
      id: message.message_id.toString(),
      chat_id: message.chat.id.toString(),
      chat_title: chatConfig.title,
      chat_type: message.chat.type,
      user_id: message.from!.id.toString(),
      content: message.text || message['caption'] || '',
      attachments,
      timestamp: new Date(message.date * 1000).toISOString(),
      message_type: this.getMessageType(message),
      category: chatConfig.category,
      metadata
    };

    // Add optional fields only if they exist
    if (message.from!.username) telegramMessage.username = message.from!.username;
    if (message.from!.first_name) telegramMessage.first_name = message.from!.first_name;
    if (message.from!.last_name) telegramMessage.last_name = message.from!.last_name;
    if (message.edit_date) telegramMessage.edited_timestamp = new Date(message.edit_date * 1000).toISOString();
    if (message.reply_to_message?.message_id) telegramMessage.reply_to_message_id = message.reply_to_message.message_id.toString();
    if (message.reply_to_message?.from?.id) telegramMessage.reply_to_user_id = message.reply_to_message.from.id.toString();
    if (message.forward_from_chat?.id) telegramMessage.forward_from_chat_id = message.forward_from_chat.id.toString();
    if (message.forward_from_message_id) telegramMessage.forward_from_message_id = message.forward_from_message_id.toString();
    if (message.forward_date) telegramMessage.forward_date = new Date(message.forward_date * 1000).toISOString();

    return telegramMessage;
  }

  private getMessageType(message: TelegramBot.Message): string {
    if (message.photo) return 'photo';
    if (message.video) return 'video';
    if (message.document) return 'document';
    if (message.audio) return 'audio';
    if (message.voice) return 'voice';
    if (message.sticker) return 'sticker';
    if (message.animation) return 'animation';
    if (message.video_note) return 'video_note';
    if (message.contact) return 'contact';
    if (message.location) return 'location';
    if (message.venue) return 'venue';
    if (message.poll) return 'poll';
    if (message.dice) return 'dice';
    return 'text';
  }

  private async updateChatStats(message: TelegramBot.Message, chatConfig: TelegramChatConfig): Promise<void> {
    try {
      // Get existing stats
      const existingStats = await databaseService.getTelegramChatStats(chatConfig.id);
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));

      let stats = existingStats.data || {
        chat_id: chatConfig.id,
        chat_title: chatConfig.title,
        chat_type: chatConfig.type,
        category: chatConfig.category,
        total_messages: 0,
        messages_today: 0,
        messages_this_week: 0,
        last_message_at: new Date(message.date * 1000).toISOString(),
        active_users_count: 0,
        updated_at: now.toISOString()
      };

      stats.total_messages += 1;
      stats.last_message_at = new Date(message.date * 1000).toISOString();

      // Reset daily/weekly counters if needed
      if (stats.last_message_at) {
        const lastMessageDate = new Date(stats.last_message_at);
        if (lastMessageDate < today) {
          stats.messages_today = 0;
        }
        if (lastMessageDate < thisWeek) {
          stats.messages_this_week = 0;
        }
      }

      stats.messages_today += 1;
      stats.messages_this_week += 1;

      await databaseService.updateTelegramChatStats(stats);
    } catch (error) {
      logger.error('Error updating chat stats:', error);
    }
  }

  private async updateUserActivity(message: TelegramBot.Message, chatConfig: TelegramChatConfig): Promise<void> {
    try {
      const messageTimestamp = new Date(message.date * 1000).toISOString();
      
      await databaseService.updateTelegramUserActivity({
        user_id: message.from!.id.toString(),
        username: message.from!.username || '',
        first_name: message.from!.first_name || '',
        last_name: message.from!.last_name || '',
        chat_id: chatConfig.id,
        chat_title: chatConfig.title,
        category: chatConfig.category,
        message_count: 1,
        last_message_at: messageTimestamp,
        first_message_at: messageTimestamp
      });
    } catch (error) {
      logger.error('Error updating user activity:', error);
    }
  }

  async sendMessage(chatId: string, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
    return await telegramRateLimiter.executeWithRetry(
      () => this.bot.sendMessage(chatId, text, options),
      'send message'
    );
  }

  getChatConfigs(): TelegramChatConfig[] {
    return Array.from(this.chatConfigs.values());
  }

  async refreshChatConfigurations(): Promise<void> {
    await this.initializeChatConfigurations();
  }

  isReady(): boolean {
    return this.isStarted;
  }

  async getBot(): Promise<TelegramBot> {
    return this.bot;
  }
}

export const telegramService = new TelegramService(); 