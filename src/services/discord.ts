import { Client, GatewayIntentBits, Message, TextChannel, EmbedBuilder, Collection, GuildChannel } from 'discord.js';
import { DiscordMessage, ChannelConfig, CategoryConfig, MessageAttachment, MessageEmbed } from '@/types';
import { botConfig, getCategoryFromCategoryName, getCategoryFromChannelName, shouldIncludeChannel } from '@/config/bot';
import { databaseService } from './database';
import { logger } from '@/utils/logger';
import { discordRateLimiter } from '@/utils/discordRateLimit';

export class DiscordService {
  private client: Client;
  private categoryConfigs: Map<string, CategoryConfig>;
  private channelConfigs: Map<string, ChannelConfig>;
  private messageCache: Collection<string, Message>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });
    
    this.categoryConfigs = new Map();
    this.channelConfigs = new Map();
    this.messageCache = new Collection();
    this.initializeCategoryConfigs();
    this.setupEventHandlers();
  }

  private initializeCategoryConfigs(): void {
    botConfig.categories.forEach(config => {
      this.categoryConfigs.set(config.id, config);
    });
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
      await this.discoverAndConfigureChannels();
      
      // Backfill historical messages if enabled
      if (process.env['BACKFILL_HISTORICAL_MESSAGES'] === 'true') {
        logger.info('🔄 Historical message backfill is enabled');
        await this.backfillHistoricalMessages();
      } else {
        logger.info('ℹ️ Historical message backfill is disabled. Set BACKFILL_HISTORICAL_MESSAGES=true to enable on startup.');
      }
    });

    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('messageUpdate', async (_oldMessage, newMessage) => {
      if (newMessage.partial) {
        try {
          await newMessage.fetch();
        } catch (error) {
          logger.error('Error fetching partial message:', error);
          return;
        }
      }
      await this.handleMessageUpdate(newMessage as Message);
    });

    this.client.on('messageDelete', async (message) => {
      await this.handleMessageDelete(message);
    });

    this.client.on('channelCreate', async (channel) => {
      if ((channel.isTextBased() || channel.type === 15) && channel.parent) { // 15 = GUILD_FORUM
        await this.handleChannelCreate(channel as GuildChannel);
      }
    });

    this.client.on('channelDelete', async (channel) => {
      if (channel.isTextBased() || channel.type === 15) { // 15 = GUILD_FORUM
        this.handleChannelDelete(channel as GuildChannel);
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      logger.warn('Discord client warning:', warning);
    });

    // Thread event handlers
    this.client.on('threadCreate', async (thread) => {
      await this.handleThreadCreate(thread);
    });

    this.client.on('threadDelete', async (thread) => {
      this.handleThreadDelete(thread);
    });

    this.client.on('threadUpdate', async (oldThread, newThread) => {
      await this.handleThreadUpdate(oldThread, newThread);
    });
  }

  async start(): Promise<void> {
    try {
      await this.client.login(botConfig.discord.token);
      logger.info('Discord bot started successfully');
    } catch (error) {
      logger.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.client.destroy();
      logger.info('Discord bot stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Discord bot:', error);
      throw error;
    }
  }

  private async discoverAndConfigureChannels(): Promise<void> {
    try {
      logger.info('🔍 Discovering and configuring channels with rate limiting...');
      
      const guild = await discordRateLimiter.executeWithRetry(
        () => this.client.guilds.fetch(botConfig.discord.guildId),
        'fetch guild for discovery'
      ) as any;
      
      const channels = await discordRateLimiter.executeWithRetry(
        () => guild.channels.fetch(),
        'fetch channels for discovery'
      ) as any;

      // Clear existing channel configs but preserve individual channel configs from botConfig
      this.channelConfigs.clear();
      const individualChannelConfigs = botConfig.channels.filter(config => config.category_id === 'individual');
      botConfig.channels = [...individualChannelConfigs];

      // First, add individual channel configurations
      logger.info(`🔍 Processing ${individualChannelConfigs.length} individual channel configurations...`);
      
      for (const channelConfig of individualChannelConfigs) {
        logger.debug(`🔍 Looking for individual channel: ${channelConfig.id} (${channelConfig.name})`);
        const channel = channels.get(channelConfig.id);
        
        if (!channel) {
          logger.warn(`❌ Individual channel ${channelConfig.id} (${channelConfig.name}) not found in guild ${botConfig.discord.guildId}`);
          logger.debug(`   Available channels: ${Array.from(channels.keys()).slice(0, 10).join(', ')}...`);
          continue;
        }
        
        if (!channel.isTextBased() && channel.type !== 15) { // 15 = GUILD_FORUM
          logger.warn(`❌ Individual channel ${channelConfig.id} (${channelConfig.name}) exists but is not a text or forum channel (type: ${channel.type})`);
          continue;
        }
        
        // Update channel config with actual Discord channel information
        channelConfig.name = channel.name;
        this.channelConfigs.set(channelConfig.id, channelConfig);
        
        logger.info(`📢 Monitoring individual channel: ${channel.name} (${channelConfig.id}) - ${channelConfig.category} - ${channelConfig.tge_phase}`);
        
                  // Join existing threads in this channel (with rate limiting)
          try {
            if (channel.type === 15) { // GUILD_FORUM
              await this.joinExistingForumPosts(channel as any, channelConfig);
            } else {
              await this.joinExistingThreads(channel as TextChannel, channelConfig);
            }
          } catch (error) {
            logger.error(`Failed to join threads in ${channel.name}:`, error);
            // Continue processing other channels even if one fails
          }
      }

      // Then, process each monitored category
      for (const [categoryId, categoryConfig] of this.categoryConfigs) {
        const categoryChannel = channels.get(categoryId);
        
        if (!categoryChannel || categoryChannel.type !== 4) { // 4 = GUILD_CATEGORY
          logger.warn(`Category ${categoryId} not found or is not a category channel`);
          continue;
        }

        // Update category config with actual name
        categoryConfig.name = categoryChannel.name;
        categoryConfig.message_category = getCategoryFromCategoryName(categoryChannel.name);

        logger.info(`Processing category: ${categoryChannel.name} (${categoryId})`);

        // Find all text channels and forum channels in this category
        const categoryTextChannels = channels.filter((channel: any) => 
          channel?.parent?.id === categoryId && 
          (channel.isTextBased() || channel.type === 15) && // 15 = GUILD_FORUM
          (channel.type === 0 || channel.type === 15) // GUILD_TEXT or GUILD_FORUM
        );

        for (const [channelId, channel] of categoryTextChannels) {
          if (!channel || !channel.isTextBased()) continue;

          // Skip if this channel is already configured as an individual channel
          if (this.channelConfigs.has(channelId)) {
            logger.debug(`Skipping channel ${channel.name} - already configured as individual channel`);
            continue;
          }

          const channelName = channel.name;
          
          // Check if channel should be included based on patterns
          if (!shouldIncludeChannel(channelName, categoryConfig.include_patterns, categoryConfig.exclude_patterns)) {
            logger.debug(`Skipping channel ${channelName} due to filter patterns`);
            continue;
          }

          const channelConfig: ChannelConfig = {
            id: channelId,
            name: channelName,
            category_id: categoryId,
            category_name: categoryChannel.name,
            category: categoryConfig.message_category || getCategoryFromChannelName(channelName),
            tge_phase: categoryConfig.tge_phase,
            monitoring_enabled: categoryConfig.monitoring_enabled,
            filters: categoryConfig.filters || []
          };

          this.channelConfigs.set(channelId, channelConfig);
          botConfig.channels.push(channelConfig);

          logger.info(`📢 Monitoring channel: ${channelName} (${channelId}) in category ${categoryChannel.name} - ${channelConfig.category} - ${channelConfig.tge_phase}`);

          // Join existing threads in this channel (with rate limiting)
          try {
            if (channel.type === 15) { // GUILD_FORUM
              await this.joinExistingForumPosts(channel as any, channelConfig);
            } else {
              await this.joinExistingThreads(channel as TextChannel, channelConfig);
            }
          } catch (error) {
            logger.error(`Failed to join threads in ${channelName}:`, error);
            // Continue processing other channels even if one fails
          }
        }
      }

      logger.info(`✅ Discovered and configured ${this.channelConfigs.size} channels (${individualChannelConfigs.length} individual, ${this.channelConfigs.size - individualChannelConfigs.length} from ${this.categoryConfigs.size} categories)`);
    } catch (error) {
      logger.error('Failed to discover and configure channels:', error);
      throw error;
    }
  }



  private async handleChannelCreate(channel: GuildChannel): Promise<void> {
    if (!channel.parent || !this.categoryConfigs.has(channel.parent.id)) {
      return;
    }

    const categoryConfig = this.categoryConfigs.get(channel.parent.id)!;
    const channelName = channel.name;

    // Check if channel should be included
    if (!shouldIncludeChannel(channelName, categoryConfig.include_patterns, categoryConfig.exclude_patterns)) {
      return;
    }

    const channelConfig: ChannelConfig = {
      id: channel.id,
      name: channelName,
      category_id: channel.parent.id,
      category_name: channel.parent.name,
      category: categoryConfig.message_category || getCategoryFromChannelName(channelName),
      tge_phase: categoryConfig.tge_phase,
      monitoring_enabled: categoryConfig.monitoring_enabled,
      filters: categoryConfig.filters || []
    };

    this.channelConfigs.set(channel.id, channelConfig);
    botConfig.channels.push(channelConfig);

    logger.info(`📢 New channel detected and configured: ${channelName} (${channel.id}) in category ${channel.parent.name}`);
  }

  private handleChannelDelete(channel: GuildChannel): void {
    if (this.channelConfigs.has(channel.id)) {
      this.channelConfigs.delete(channel.id);
      botConfig.channels = botConfig.channels.filter(c => c.id !== channel.id);
      logger.info(`Channel removed from monitoring: ${channel.name} (${channel.id})`);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    // Skip bot messages
    if (message.author.bot) {
      return;
    }

    // Check if message is from a thread
    const isThread = message.channel.isThread();
    
    // Enhanced debug logging - only for threads to reduce noise
    if (isThread) {
      logger.debug(`📨 Processing message from ${message.author.username} in channel ${message.channelId}`);
    }
    let channelConfig: ChannelConfig | undefined;
    let parentChannelId: string | undefined;
    let parentChannelName: string | undefined;
    let threadName: string | undefined;

    if (isThread) {
      // For thread messages, use parent channel's configuration
      const threadChannel = message.channel as any;
      parentChannelId = threadChannel.parentId || threadChannel.parent?.id;
      parentChannelName = threadChannel.parent?.name;
      threadName = threadChannel.name;
      
      logger.debug(`🧵 Thread message detected:`);
      logger.debug(`   Thread Name: ${threadName}`);
      logger.debug(`   Thread Channel ID: ${message.channelId}`);
      logger.debug(`   Parent Channel ID: ${parentChannelId}`);
      logger.debug(`   Parent Channel Name: ${parentChannelName}`);
      logger.debug(`   Monitored Channels: ${Array.from(this.channelConfigs.keys()).join(', ')}`);

      // If parent channel info is missing, try to fetch it
      if (!parentChannelId || !parentChannelName) {
        try {
          logger.debug(`🔄 Fetching parent channel info for thread ${threadName}...`);
          const fullThread = await discordRateLimiter.executeWithRetry(
            () => this.client.channels.fetch(message.channelId),
            `fetch thread parent info for ${threadName}`
          );
          if (fullThread && fullThread.isThread()) {
            const thread = fullThread as any;
            parentChannelId = thread.parentId || thread.parent?.id;
            parentChannelName = thread.parent?.name;
            logger.debug(`✅ Fetched parent info - ID: ${parentChannelId}, Name: ${parentChannelName}`);
          }
        } catch (error) {
          logger.error(`❌ Failed to fetch thread parent info:`, error);
        }
      }

      if (!parentChannelId) {
        logger.error(`❌ Thread ${threadName} has no parent channel ID - cannot process`);
        return;
      }

      if (!this.channelConfigs.has(parentChannelId)) {
        logger.debug(`⚠️ Thread ${threadName} parent channel ${parentChannelId} is not monitored - skipping`);
        return; // Parent channel not monitored
      }
      
      channelConfig = this.channelConfigs.get(parentChannelId)!;
      logger.debug(`✅ Found channel config for parent: ${channelConfig.name} (monitoring: ${channelConfig.monitoring_enabled})`);
      
      // ✅ THREADS ARE NOT FILTERED BY PATTERNS - All thread messages in monitored channels are processed
      logger.debug(`🔍 Thread pattern filtering: DISABLED (all thread messages processed)`);
      logger.debug(`   Thread "${threadName}" will be processed regardless of name patterns`);
    } else {
      // Regular channel message
      logger.debug(`📝 Regular channel message in ${message.channelId}`);
      if (!this.channelConfigs.has(message.channelId)) {
        logger.debug(`⚠️ Channel ${message.channelId} is not monitored - skipping`);
        return; // Channel not monitored
      }
      channelConfig = this.channelConfigs.get(message.channelId)!;
    }
    
    if (!channelConfig.monitoring_enabled) {
      return;
    }

    try {
      const discordMessage = await this.convertToDiscordMessage(message, channelConfig, isThread, threadName, parentChannelId, parentChannelName);
      
      // Cache the message for potential updates/deletes
      this.messageCache.set(message.id, message);
      
      // Save to database
      const result = await databaseService.saveMessage({
        id: message.id,
        ...discordMessage
      });
      
      if (result.success) {
        if (isThread) {
          logger.info(`✅ 🧵 THREAD MESSAGE SAVED from ${message.author.username}`);
          logger.info(`   🧵 Thread: "${threadName}"`);
          logger.info(`   📝 Parent Channel: "${channelConfig.name}" (${channelConfig.category_name})`);
          logger.info(`   📊 Stored with channel_name="${parentChannelName}", is_thread=true`);
          logger.info(`   🆔 Message ID: ${message.id}`);
          logger.info(`   💬 Content: "${message.content?.substring(0, 100)}..."`);
        } else {
          logger.debug(`✅ Message saved from ${message.author.username} in ${channelConfig.name} (${channelConfig.category_name})`);
        }
        
        // Update channel stats and user activity (always use parent channel for threads)
        await this.updateChannelStats(message, channelConfig, parentChannelId);
        await this.updateUserActivity(message, channelConfig, parentChannelId);
      } else {
        // Check if this is a duplicate message error (which is now handled gracefully)
        if (result.code === '23505') {
          logger.debug(`📝 Message ${message.id} was processed successfully (duplicate handled)`);
          // Still update stats even if message was a duplicate
          await this.updateChannelStats(message, channelConfig, parentChannelId);
          await this.updateUserActivity(message, channelConfig, parentChannelId);
        } else {
          // This is a real error
          logger.error(`❌ Failed to save message: ${result.error}`);
          if (isThread) {
            logger.error(`   🧵 Failed thread: "${threadName}" in parent "${channelConfig.name}"`);
            logger.error(`   📝 Message from: ${message.author.username}`);
            logger.error(`   💬 Content: "${message.content?.substring(0, 50)}..."`);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  }

  private async handleMessageUpdate(message: Message): Promise<void> {
    if (message.author.bot) {
      return;
    }

    // Check if message is from a thread
    const isThread = message.channel.isThread();
    let channelConfig: ChannelConfig | undefined;
    let parentChannelId: string | undefined;
    let parentChannelName: string | undefined;
    let threadName: string | undefined;

    if (isThread) {
      // For thread messages, use parent channel's configuration
      const threadChannel = message.channel as any;
      parentChannelId = threadChannel.parentId || threadChannel.parent?.id;
      parentChannelName = threadChannel.parent?.name;
      threadName = threadChannel.name;
      
      if (!parentChannelId || !this.channelConfigs.has(parentChannelId)) {
        return; // Parent channel not monitored
      }
      
      channelConfig = this.channelConfigs.get(parentChannelId)!;
    } else {
      // Regular channel message
      if (!this.channelConfigs.has(message.channelId)) {
        return; // Channel not monitored
      }
      channelConfig = this.channelConfigs.get(message.channelId)!;
    }
    
    if (!channelConfig.monitoring_enabled) {
      return;
    }

    try {
      const discordMessage = await this.convertToDiscordMessage(message, channelConfig, isThread, threadName, parentChannelId, parentChannelName);
      
      // Update in database
      const result = await databaseService.updateMessage(message.id, {
        content: discordMessage.content,
        attachments: discordMessage.attachments,
        embeds: discordMessage.embeds,
        ...(discordMessage.edited_timestamp && { edited_timestamp: discordMessage.edited_timestamp }),
        metadata: discordMessage.metadata
      });
      
      if (result.success) {
        const location = isThread ? `thread ${threadName}` : channelConfig.name;
        logger.debug(`Updated message ${message.id} from ${message.author.username} in ${location}`);
      } else {
        logger.error(`Failed to update message: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error handling message update:', error);
    }
  }

  private async handleMessageDelete(message: Message | { id: string; channelId: string }): Promise<void> {
    try {
      const result = await databaseService.deleteMessage(message.id);
      
      if (result.success) {
        logger.debug(`Deleted message ${message.id}`);
      } else {
        logger.error(`Failed to delete message: ${result.error}`);
      }
      
      // Remove from cache
      this.messageCache.delete(message.id);
    } catch (error) {
      logger.error('Error handling message delete:', error);
    }
  }

  private async convertToDiscordMessage(
    message: Message, 
    channelConfig: ChannelConfig, 
    isThread: boolean = false, 
    threadName?: string, 
    parentChannelId?: string, 
    parentChannelName?: string
  ): Promise<Omit<DiscordMessage, 'id' | 'created_at' | 'updated_at'>> {
    const attachments: MessageAttachment[] = message.attachments.map(attachment => ({
      id: attachment.id,
      filename: attachment.name,
      size: attachment.size,
      url: attachment.url,
      content_type: attachment.contentType || undefined,
      width: attachment.width || undefined,
      height: attachment.height || undefined
    }));

    const embeds: MessageEmbed[] = message.embeds.map(embed => ({
      title: embed.title || undefined,
      description: embed.description || undefined,
      url: embed.url || undefined,
      color: embed.color || undefined,
      timestamp: embed.timestamp || undefined,
      footer: embed.footer ? {
        text: embed.footer.text,
        icon_url: embed.footer.iconURL || undefined
      } : undefined,
      image: embed.image ? {
        url: embed.image.url,
        width: embed.image.width || undefined,
        height: embed.image.height || undefined
      } : undefined,
      author: embed.author ? {
        name: embed.author.name,
        url: embed.author.url || undefined,
        icon_url: embed.author.iconURL || undefined
      } : undefined,
      fields: embed.fields.map(field => ({
        name: field.name,
        value: field.value,
        inline: field.inline || undefined
      }))
    }));

    const baseMessage = {
      channel_id: message.channelId,
      channel_name: isThread ? (parentChannelName || channelConfig.name) : channelConfig.name,
      guild_id: message.guildId!,
      author_id: message.author.id,
      author_username: message.author.username,
      author_display_name: message.author.displayName || message.author.username,
      content: message.content,
      attachments,
      embeds,
      timestamp: message.createdAt.toISOString(),
      ...(message.editedAt && { edited_timestamp: message.editedAt.toISOString() }),
      message_type: message.type.toString(),
      category: channelConfig.category,
      discord_tge_phase: channelConfig.tge_phase,
      is_thread: isThread,
      metadata: {
        mentions: message.mentions.users.map(user => ({ id: user.id, username: user.username })),
        reactions: message.reactions.cache.map(reaction => ({
          emoji: reaction.emoji.name,
          count: reaction.count
        })),
        // Enhanced thread metadata
        ...(isThread && {
          thread_info: {
            thread_id: message.channelId,
            thread_name: threadName,
            parent_channel_id: parentChannelId,
            parent_channel_name: parentChannelName,
            message_source: 'thread'
          }
        })
      }
    };

    // Add optional thread properties only if they exist
    return {
      ...baseMessage,
      ...(isThread && threadName && { thread_name: threadName }),
      ...(parentChannelId && { parent_channel_id: parentChannelId }),
      ...(parentChannelName && { parent_channel_name: parentChannelName })
    };
  }

  private async updateChannelStats(message: Message, channelConfig: ChannelConfig, parentChannelId?: string): Promise<void> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Use parent channel ID for threads to aggregate stats
      const statsChannelId = parentChannelId || channelConfig.id;
      
      // Get current stats
      const statsResult = await databaseService.getChannelStats(statsChannelId);
      const currentStats = statsResult.data;

      // Calculate new stats
      const totalMessages = (currentStats?.total_messages || 0) + 1;
      const messagesToday = currentStats?.messages_today || 0;
      const lastMessageDate = currentStats?.last_message_at ? 
        new Date(currentStats.last_message_at).toISOString().split('T')[0] : null;
      
      const messagesTodayCount = lastMessageDate === today ? messagesToday + 1 : 1;

      await databaseService.updateChannelStats({
        channel_id: statsChannelId,
        channel_name: channelConfig.name,
        category: channelConfig.category,
        discord_tge_phase: channelConfig.tge_phase,
        total_messages: totalMessages,
        messages_today: messagesTodayCount,
        messages_this_week: totalMessages, // Simplified for now
        last_message_at: message.createdAt.toISOString(),
        active_users_count: 0 // Will be calculated separately
      });
    } catch (error) {
      logger.error('Error updating channel stats:', error);
    }
  }

  private async updateUserActivity(message: Message, channelConfig: ChannelConfig, parentChannelId?: string): Promise<void> {
    try {
      // Use parent channel ID for threads to aggregate user activity
      const activityChannelId = parentChannelId || channelConfig.id;
      
      await databaseService.updateUserActivity({
        user_id: message.author.id,
        username: message.author.username,
        display_name: message.author.displayName || message.author.username,
        channel_id: activityChannelId,
        channel_name: channelConfig.name,
        category: channelConfig.category,
        discord_tge_phase: channelConfig.tge_phase,
        message_count: 0, // Placeholder - function handles counting
        last_message_at: message.createdAt.toISOString(),
        first_message_at: message.createdAt.toISOString() // Placeholder - function handles this
      });
    } catch (error) {
      logger.error('Error updating user activity:', error);
    }
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    try {
      const channel = await discordRateLimiter.executeWithRetry(
        () => this.client.channels.fetch(channelId),
        `fetch channel ${channelId} for message`
      ) as TextChannel;
      if (channel?.isTextBased()) {
        await discordRateLimiter.executeWithRetry(
          () => channel.send(content),
          `send message to channel ${channelId}`
        );
        logger.debug(`Sent message to channel ${channelId}`);
      }
    } catch (error) {
      logger.error(`Failed to send message to channel ${channelId}:`, error);
    }
  }

  async sendEmbed(channelId: string, embed: EmbedBuilder): Promise<void> {
    try {
      const channel = await discordRateLimiter.executeWithRetry(
        () => this.client.channels.fetch(channelId),
        `fetch channel ${channelId} for embed`
      ) as TextChannel;
      if (channel?.isTextBased()) {
        await discordRateLimiter.executeWithRetry(
          () => channel.send({ embeds: [embed] }),
          `send embed to channel ${channelId}`
        );
        logger.debug(`Sent embed to channel ${channelId}`);
      }
    } catch (error) {
      logger.error(`Failed to send embed to channel ${channelId}:`, error);
    }
  }

  getChannelConfigs(): ChannelConfig[] {
    return Array.from(this.channelConfigs.values());
  }

  getCategoryConfigs(): CategoryConfig[] {
    return Array.from(this.categoryConfigs.values());
  }

  async refreshChannelConfigurations(): Promise<void> {
    logger.info('Refreshing channel configurations...');
    await this.discoverAndConfigureChannels();
  }

  isReady(): boolean {
    return this.client.isReady();
  }

  async verifyThreadStorage(): Promise<void> {
    try {
      logger.info('🧵 Verifying thread message storage...');
      
      // Get recent thread messages
      const threadResult = await databaseService.getThreadMessages(5);
      
      if (threadResult.success && threadResult.data) {
        logger.info(`📊 Found ${threadResult.data.length} recent thread messages:`);
        
        threadResult.data.forEach((message, index) => {
          logger.info(`  ${index + 1}. 🧵 Thread Message Record:`);
          logger.info(`     📝 channel_name: "${message.channel_name}" (PARENT CHANNEL NAME)`);
          logger.info(`     🧵 thread_name: "${message.thread_name}"`);
          logger.info(`     ✅ is_thread: ${message.is_thread}`);
          logger.info(`     👤 Author: ${message.author_username}`);
          logger.info(`     💬 Content: "${message.content?.substring(0, 50)}..."`);
          logger.info(`     🆔 Message ID: ${message.id}`);
          logger.info(`     📍 Thread Channel ID: ${message.channel_id}`);
          logger.info(`     📍 Parent Channel ID: ${message.parent_channel_id}`);
          logger.info(`     🏷️  Category: ${message.category}`);
          logger.info(`     ⏰ Timestamp: ${message.timestamp}`);
          logger.info('     ---');
        });
      } else {
        logger.warn('No thread messages found or error retrieving them');
      }

      // Verify channel stats aggregation
      const channelConfigs = Array.from(this.channelConfigs.values());
      logger.info(`📈 Monitoring ${channelConfigs.length} channels for thread aggregation`);
      
      for (const config of channelConfigs.slice(0, 3)) { // Check first 3 channels
        const statsResult = await databaseService.getChannelStats(config.id);
        if (statsResult.success && statsResult.data) {
          logger.info(`  📊 ${config.name}: ${statsResult.data.total_messages} total messages`);
        }
      }
      
    } catch (error) {
      logger.error('Error verifying thread storage:', error);
    }
  }

    async verifyThreadJoining(): Promise<void> {
    try {
      logger.info('🧵 Verifying thread joining status...');
      
      const guild = await discordRateLimiter.executeWithRetry(
        () => this.client.guilds.fetch(botConfig.discord.guildId),
        'fetch guild for thread verification'
      ) as any;
      const channels = await discordRateLimiter.executeWithRetry(
        () => guild.channels.fetch(),
        'fetch channels for thread verification'
      ) as any;
      
      let totalThreads = 0;
      let joinedThreads = 0;
      let failedThreads = 0;
      
      for (const [_channelId, channelConfig] of this.channelConfigs) {
        const channel = channels.get(channelConfig.id);
        if (!channel || !channel.isTextBased()) continue;
        
        try {
          const textChannel = channel as TextChannel;
          const activeThreads = await discordRateLimiter.executeWithRetry(
            () => textChannel.threads.fetchActive(),
            `fetch active threads from ${channelConfig.name} for verification`
          ) as any;
          const threads = activeThreads.threads;
          
          if (threads.size > 0) {
            logger.info(`🧵 Channel "${channelConfig.name}" has ${threads.size} active threads:`);
            
            for (const [threadId, thread] of threads) {
              totalThreads++;
              if (thread.joined) {
                joinedThreads++;
                logger.info(`  ✅ ${thread.name} (${threadId}) - JOINED`);
              } else {
                failedThreads++;
                logger.warn(`  ❌ ${thread.name} (${threadId}) - NOT JOINED`);
              }
            }
          }
        } catch (error) {
          logger.error(`Error checking threads in ${channelConfig.name}:`, error);
        }
      }
      
      logger.info(`🧵 Thread Joining Summary:`);
      logger.info(`  Total active threads: ${totalThreads}`);
      logger.info(`  Joined threads: ${joinedThreads}`);
      logger.info(`  Failed to join: ${failedThreads}`);
      
      if (failedThreads > 0) {
        logger.warn('❌ Some threads are not joined - thread messages from these may not be captured!');
      } else if (totalThreads > 0) {
        logger.info('✅ All active threads are joined - thread messages should be captured!');
      } else {
        logger.info('ℹ️ No active threads found in monitored channels');
      }
      
    } catch (error) {
      logger.error('Error verifying thread joining:', error);
    }
  }

  async testThreadMessageProcessing(): Promise<void> {
    try {
      logger.info('🧪 Testing thread message processing...');
      
      const guild = await discordRateLimiter.executeWithRetry(
        () => this.client.guilds.fetch(botConfig.discord.guildId),
        'fetch guild for testing'
      ) as any;
      const channels = await discordRateLimiter.executeWithRetry(
        () => guild.channels.fetch(),
        'fetch channels for testing'
      ) as any;
      
      for (const [_channelId, channelConfig] of this.channelConfigs) {
        const channel = channels.get(channelConfig.id);
        if (!channel || !channel.isTextBased()) continue;
        
        try {
          const textChannel = channel as TextChannel;
          const activeThreads = await discordRateLimiter.executeWithRetry(
            () => textChannel.threads.fetchActive(),
            `fetch active threads from ${channelConfig.name} for testing`
          ) as any;
          const threads = activeThreads.threads;
          
          if (threads.size > 0) {
            logger.info(`🧵 Testing threads in channel "${channelConfig.name}":`);
            
            for (const [threadId, thread] of threads) {
              logger.info(`  🧵 Thread: ${thread.name} (${threadId})`);
              logger.info(`    - Joined: ${thread.joined}`);
              logger.info(`    - Parent ID: ${thread.parentId || 'undefined'}`);
              logger.info(`    - Parent Name: ${textChannel.name}`);
              logger.info(`    - Archived: ${thread.archived}`);
              
              // Threads are no longer filtered by patterns
              logger.info(`    - Pattern filtering: DISABLED for threads`);
              logger.info(`    - Thread will be processed: YES (patterns don't apply to threads)`);
              
              const categoryConfig = this.categoryConfigs.get(channelConfig.category_id);
              if (categoryConfig) {
                logger.info(`    - Parent channel patterns (not applied to threads):`);
                logger.info(`      - Include patterns: ${JSON.stringify(categoryConfig.include_patterns)}`);
                logger.info(`      - Exclude patterns: ${JSON.stringify(categoryConfig.exclude_patterns)}`);
              }
              
              // Try to fetch recent messages from this thread
              try {
                const messages = await discordRateLimiter.executeWithRetry(
                  () => thread.messages.fetch({ limit: 5 }),
                  `fetch messages from thread ${thread.name}`
                ) as any;
                logger.info(`    - Recent messages: ${messages.size}`);
                
                messages.forEach((msg: any) => {
                  if (!msg.author.bot) {
                    logger.info(`      📝 Message from ${msg.author.username}: "${msg.content?.substring(0, 50)}..."`);
                  }
                });
              } catch (msgError) {
                logger.error(`    ❌ Could not fetch messages from thread:`, msgError);
              }
            }
          } else {
            logger.info(`📝 Channel "${channelConfig.name}" has no active threads`);
          }
        } catch (error) {
          logger.error(`Error testing threads in ${channelConfig.name}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Error testing thread message processing:', error);
    }
  }

  async debugCategoryConfigurations(): Promise<void> {
    try {
      logger.info('🔍 Current Category Configurations:');
      
      for (const [categoryId, categoryConfig] of this.categoryConfigs) {
        logger.info(`📂 Category: ${categoryConfig.name || 'Unknown'} (${categoryId})`);
        logger.info(`   - Monitoring enabled: ${categoryConfig.monitoring_enabled}`);
        logger.info(`   - TGE Phase: ${categoryConfig.tge_phase}`);
        logger.info(`   - Message Category: ${categoryConfig.message_category}`);
        logger.info(`   - Include patterns: ${JSON.stringify(categoryConfig.include_patterns)}`);
        logger.info(`   - Exclude patterns: ${JSON.stringify(categoryConfig.exclude_patterns)}`);
        logger.info(`   - NOTE: Patterns only apply to channels, NOT threads`);
        
        // Show monitored channels in this category
        const channelsInCategory = Array.from(this.channelConfigs.values())
          .filter(ch => ch.category_id === categoryId);
        
        if (channelsInCategory.length > 0) {
          logger.info(`   - Monitored channels (${channelsInCategory.length}):`);
          channelsInCategory.forEach(ch => {
            logger.info(`     📢 ${ch.name} (${ch.id})`);
          });
        } else {
          logger.warn(`   - ⚠️ No monitored channels in this category`);
        }
        logger.info('   ---');
      }
      
    } catch (error) {
      logger.error('Error debugging category configurations:', error);
    }
  }

  async debugAllChannels(): Promise<void> {
    try {
      logger.info('🔍 Debug: All Available Channels');
      
      const guild = await discordRateLimiter.executeWithRetry(
        () => this.client.guilds.fetch(botConfig.discord.guildId),
        'fetch guild for debug'
      );
      
      const channels = await discordRateLimiter.executeWithRetry(
        () => guild.channels.fetch(),
        'fetch channels for debug'
      );

      logger.info(`Guild: ${guild.name} (${guild.id})`);
      logger.info(`Total channels: ${channels.size}`);
      
      // List all channels with their types
      logger.info('📋 All Channels:');
      for (const [channelId, channel] of channels) {
        if (!channel) continue;
        
        const channelType = channel.type;
        const channelName = channel.name || 'Unknown';
        const categoryName = channel.parent ? channel.parent.name : 'No Category';
        const isTextBased = channel.isTextBased();
        const isForum = channel.type === 15;
        const channelTypeText = isForum ? 'GUILD_FORUM' : channelType;
        
        logger.info(`  ${channelName} (${channelId}) - Type: ${channelTypeText} - TextBased: ${isTextBased} - Forum: ${isForum} - Category: ${categoryName}`);
      }
      
      // Check individual channels from config
      const individualChannelConfigs = botConfig.channels.filter(config => config.category_id === 'individual');
      if (individualChannelConfigs.length > 0) {
        logger.info('🎯 Individual Channel Check:');
        for (const config of individualChannelConfigs) {
          const channel = channels.get(config.id);
          if (channel) {
            const isForum = channel.type === 15;
            const channelTypeText = isForum ? 'GUILD_FORUM' : channel.type;
            logger.info(`  ✅ ${config.name} (${config.id}) - Found: ${channel.name} - Type: ${channelTypeText} - TextBased: ${channel.isTextBased()} - Forum: ${isForum}`);
          } else {
            logger.warn(`  ❌ ${config.name} (${config.id}) - NOT FOUND`);
          }
        }
      }
      
    } catch (error) {
      logger.error('Error in debug all channels:', error);
    }
  }

  async backfillHistoricalMessages(): Promise<void> {
    try {
      logger.info('🔄 Starting historical message backfill for all tracked channels...');
      
      const backfillLimit = parseInt(process.env['BACKFILL_MESSAGE_LIMIT'] || '100');
      const backfillDays = parseInt(process.env['BACKFILL_DAYS_LIMIT'] || '30');
      const backfillAfter = new Date(Date.now() - (backfillDays * 24 * 60 * 60 * 1000));
      
      logger.info(`📊 Backfill Settings:`);
      logger.info(`   - Message limit per channel: ${backfillLimit}`);
      logger.info(`   - Days limit: ${backfillDays} days`);
      logger.info(`   - Backfill after: ${backfillAfter.toISOString()}`);
      
      const guild = await discordRateLimiter.executeWithRetry(
        () => this.client.guilds.fetch(botConfig.discord.guildId),
        'fetch guild for backfill'
      );
      
      const channels = await discordRateLimiter.executeWithRetry(
        () => guild.channels.fetch(),
        'fetch channels for backfill'
      );

      let totalChannelsProcessed = 0;
      let totalMessagesBackfilled = 0;
      let totalThreadsProcessed = 0;
      let totalErrors = 0;

      logger.info(`📋 Processing ${this.channelConfigs.size} tracked channels for backfill...`);

      for (const [channelId, channelConfig] of this.channelConfigs) {
        const channel = channels.get(channelId);
        if (!channel) {
          logger.warn(`⚠️ Channel ${channelConfig.name} (${channelId}) not found - skipping backfill`);
          continue;
        }

        totalChannelsProcessed++;
        logger.info(`📄 [${totalChannelsProcessed}/${this.channelConfigs.size}] Backfilling channel: ${channelConfig.name}`);

        try {
          if (channel.type === 15) { // GUILD_FORUM
            const result = await this.backfillForumChannel(channel, channelConfig, backfillLimit, backfillAfter);
            totalMessagesBackfilled += result.messagesBackfilled;
            totalThreadsProcessed += result.postsProcessed;
          } else if (channel.isTextBased()) {
            const result = await this.backfillTextChannel(channel as any, channelConfig, backfillLimit, backfillAfter);
            totalMessagesBackfilled += result.messagesBackfilled;
            totalThreadsProcessed += result.threadsProcessed;
          } else {
            logger.warn(`⚠️ Channel ${channelConfig.name} is not a supported channel type - skipping`);
            continue;
          }

          logger.info(`✅ Completed backfill for ${channelConfig.name}`);
        } catch (error) {
          logger.error(`❌ Error backfilling channel ${channelConfig.name}:`, error);
          totalErrors++;
        }
      }

      logger.info('🎉 Historical message backfill completed!');
      logger.info(`📊 Backfill Summary:`);
      logger.info(`   - Channels processed: ${totalChannelsProcessed}`);
      logger.info(`   - Messages backfilled: ${totalMessagesBackfilled}`);
      logger.info(`   - Threads/Posts processed: ${totalThreadsProcessed}`);
      logger.info(`   - Errors encountered: ${totalErrors}`);
      
      if (totalMessagesBackfilled > 0) {
        logger.info(`✅ Successfully backfilled ${totalMessagesBackfilled} historical messages!`);
      }
      
    } catch (error) {
      logger.error('❌ Fatal error during historical message backfill:', error);
      throw error;
    }
  }

  private async backfillTextChannel(
    channel: any, 
    channelConfig: ChannelConfig, 
    limit: number, 
    after: Date
  ): Promise<{ messagesBackfilled: number; threadsProcessed: number }> {
    let messagesBackfilled = 0;
    let threadsProcessed = 0;

    try {
      // Backfill main channel messages
      logger.info(`💬 Backfilling main channel messages for ${channelConfig.name}...`);
      const mainChannelMessages = await this.fetchHistoricalMessages(channel, channelConfig, limit, after);
      messagesBackfilled += mainChannelMessages;

      // Backfill thread messages
      logger.info(`🧵 Backfilling thread messages for ${channelConfig.name}...`);
      const [activeThreads, archivedThreads] = await Promise.all([
        discordRateLimiter.executeWithRetry(
          () => channel.threads.fetchActive(),
          `fetch active threads for backfill from ${channelConfig.name}`
        ) as Promise<any>,
        discordRateLimiter.executeWithRetry(
          () => channel.threads.fetchArchived({ fetchAll: false, limit: 50 }),
          `fetch archived threads for backfill from ${channelConfig.name}`
        ) as Promise<any>
      ]);

      const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
      
      if (allThreads.length > 0) {
        logger.info(`🧵 Found ${allThreads.length} threads in ${channelConfig.name} to backfill`);
        
        for (const thread of allThreads) {
          try {
            // Join thread if not already joined
            if (!thread.joined && !thread.archived) {
              await thread.join();
            }
            
            const threadMessages = await this.fetchHistoricalMessages(thread, channelConfig, limit, after, true, thread.name, channel.id, channel.name);
            messagesBackfilled += threadMessages;
            threadsProcessed++;
            
            logger.debug(`🧵 Backfilled ${threadMessages} messages from thread: ${thread.name}`);
          } catch (error) {
            logger.error(`❌ Error backfilling thread ${thread.name}:`, error);
          }
        }
      }

      return { messagesBackfilled, threadsProcessed };
    } catch (error) {
      logger.error(`❌ Error backfilling text channel ${channelConfig.name}:`, error);
      throw error;
    }
  }

  private async backfillForumChannel(
    channel: any, 
    channelConfig: ChannelConfig, 
    limit: number, 
    after: Date
  ): Promise<{ messagesBackfilled: number; postsProcessed: number }> {
    let messagesBackfilled = 0;
    let postsProcessed = 0;

    try {
      logger.info(`🏛️ Backfilling forum posts for ${channelConfig.name}...`);
      
      // Fetch active forum posts
      const activeThreads = await discordRateLimiter.executeWithRetry(
        () => channel.threads.fetchActive(),
        `fetch active forum posts for backfill from ${channelConfig.name}`
      ) as any;

      const allPosts = [...activeThreads.threads.values()];
      
      if (allPosts.length > 0) {
        logger.info(`🏛️ Found ${allPosts.length} forum posts in ${channelConfig.name} to backfill`);
        
        for (const post of allPosts) {
          try {
            // Join post if not already joined
            if (!post.joined && !post.archived) {
              await post.join();
            }
            
            const postMessages = await this.fetchHistoricalMessages(post, channelConfig, limit, after, true, post.name, channel.id, channel.name);
            messagesBackfilled += postMessages;
            postsProcessed++;
            
            logger.debug(`🏛️ Backfilled ${postMessages} messages from forum post: ${post.name}`);
          } catch (error) {
            logger.error(`❌ Error backfilling forum post ${post.name}:`, error);
          }
        }
      }

      return { messagesBackfilled, postsProcessed };
    } catch (error) {
      logger.error(`❌ Error backfilling forum channel ${channelConfig.name}:`, error);
      throw error;
    }
  }

  private async fetchHistoricalMessages(
    channel: any,
    channelConfig: ChannelConfig,
    limit: number,
    after: Date,
    isThread: boolean = false,
    threadName?: string,
    parentChannelId?: string,
    parentChannelName?: string
  ): Promise<number> {
    try {
      let messagesBackfilled = 0;
      let lastMessageId: string | undefined;
      let hasMore = true;
      let totalFetched = 0;

      while (hasMore && totalFetched < limit) {
        const fetchOptions: any = {
          limit: Math.min(100, limit - totalFetched) // Discord API limit is 100
        };

        if (lastMessageId) {
          fetchOptions.before = lastMessageId;
        }

        const messages = await discordRateLimiter.executeWithRetry(
          () => channel.messages.fetch(fetchOptions),
          `fetch historical messages from ${channelConfig.name}${isThread ? ` (thread: ${threadName})` : ''}`
        ) as any;

        if (messages.size === 0) {
          hasMore = false;
          break;
        }

        // Process messages in reverse chronological order (oldest first)
        const messageArray = Array.from(messages.values()).reverse();
        
        for (const message of messageArray) {
          const msg = message as any;
          
          // Skip messages older than the after date
          if (msg.createdAt < after) {
            hasMore = false;
            break;
          }

          // Skip bot messages
          if (msg.author.bot) {
            continue;
          }

          try {
            // Convert and save message (duplicates will be handled by database constraint)
            const discordMessage = await this.convertToDiscordMessage(
              msg, 
              channelConfig, 
              isThread, 
              threadName, 
              parentChannelId, 
              parentChannelName
            );

            const result = await databaseService.saveMessage({
              id: msg.id,
              ...discordMessage
            });

            if (result.success) {
              messagesBackfilled++;
              
              // Update stats
              await this.updateChannelStats(msg, channelConfig, parentChannelId);
              await this.updateUserActivity(msg, channelConfig, parentChannelId);
              
              logger.debug(`📥 Backfilled message from ${msg.author.username} in ${channelConfig.name}${isThread ? ` (thread: ${threadName})` : ''}`);
            } else {
              if (result.code !== '23505') { // Not a duplicate error
                logger.error(`❌ Failed to save backfilled message: ${result.error}`);
              }
            }
          } catch (error) {
            logger.error(`❌ Error processing backfilled message ${msg.id}:`, error);
          }
        }

        lastMessageId = (messageArray[messageArray.length - 1] as any)?.id;
        totalFetched += messageArray.length;

        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return messagesBackfilled;
    } catch (error) {
      logger.error(`❌ Error fetching historical messages from ${channelConfig.name}:`, error);
      throw error;
    }
  }

  async forceJoinAllThreads(): Promise<void> {
    try {
      logger.info('🔧 Force joining ALL threads in monitored channels with rate limiting...');
      
      const guild = await discordRateLimiter.executeWithRetry(
        () => this.client.guilds.fetch(botConfig.discord.guildId),
        'fetch guild'
      );
      
      const channels = await discordRateLimiter.executeWithRetry(
        () => guild.channels.fetch(),
        'fetch channels'
      );
      
      let totalProcessed = 0;
      let totalJoined = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      
      // Collect all threads from all channels first
      const allThreadsToProcess: Array<{ thread: any; channelName: string }> = [];
      
      for (const [_channelId, channelConfig] of this.channelConfigs) {
        const channel = channels.get(channelConfig.id);
        if (!channel || (!channel.isTextBased() && channel.type !== 15)) continue; // Support forum channels (type 15)
        
        try {
          let channelThreads: any[] = [];
          
          if (channel.type === 15) { // GUILD_FORUM
            logger.info(`🏛️ Processing forum channel: ${channelConfig.name}`);
            const activeThreads = await discordRateLimiter.executeWithRetry(
              () => channel.threads.fetchActive(),
              `fetch active forum posts from ${channelConfig.name}`
            );
            channelThreads = [...activeThreads.threads.values()];
          } else {
            // Regular text channel
            const textChannel = channel as TextChannel;
            
            const [activeThreads, archivedThreads] = await Promise.all([
              discordRateLimiter.executeWithRetry(
                () => textChannel.threads.fetchActive(),
                `fetch active threads from ${channelConfig.name}`
              ),
              discordRateLimiter.executeWithRetry(
                () => textChannel.threads.fetchArchived({ fetchAll: false, limit: 50 }),
                `fetch archived threads from ${channelConfig.name}`
              )
            ]);
            
            channelThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
          }
          
          if (channelThreads.length > 0) {
            const channelType = channel.type === 15 ? 'forum posts' : 'threads';
            logger.info(`🧵 Found ${channelThreads.length} ${channelType} in "${channelConfig.name}"`);
            channelThreads.forEach(thread => {
              allThreadsToProcess.push({ thread, channelName: channelConfig.name });
            });
          }
        } catch (error) {
          logger.error(`Error fetching threads from ${channelConfig.name}:`, error);
          totalErrors++;
        }
      }
      
      if (allThreadsToProcess.length === 0) {
        logger.info('📝 No threads found to process');
        return;
      }
      
      logger.info(`🧵 Processing ${allThreadsToProcess.length} threads with rate limiting...`);
      
      // Process threads in batches with rate limiting
      await discordRateLimiter.processBatch(
        allThreadsToProcess,
        async ({ thread, channelName }) => {
          totalProcessed++;
          
          if (!thread.joined && !thread.archived) {
            await thread.join();
            totalJoined++;
            logger.info(`   ✅ JOINED: ${thread.name} in ${channelName}`);
            return 'joined';
          } else if (thread.joined) {
            logger.debug(`   ✅ Already joined: ${thread.name} in ${channelName}`);
            totalJoined++;
            return 'already_joined';
          } else if (thread.archived) {
            logger.debug(`   ⏭️ Skipped archived: ${thread.name} in ${channelName}`);
            totalSkipped++;
            return 'skipped_archived';
          }
          
          return 'unknown';
        },
        3, // Smaller batch size for thread joins
        'thread join'
      );
      
      logger.info('🧵 Force Join Summary:');
      logger.info(`   Total threads processed: ${totalProcessed}`);
      logger.info(`   Successfully joined: ${totalJoined}`);
      logger.info(`   Skipped (archived): ${totalSkipped}`);
      logger.info(`   Errors: ${totalErrors}`);
      
      if (totalJoined > 0) {
        logger.info('✅ Thread messages should now be captured from all joined threads!');
      }
      
    } catch (error) {
      logger.error('Error force joining threads:', error);
      throw error;
    }
  }

  // Method to demonstrate thread storage behavior
  async demonstrateThreadStorage(): Promise<void> {
    logger.info('🧵 Thread Storage Behavior Summary:');
    logger.info('');
    logger.info('When a message is sent in a thread:');
    logger.info('1. ✅ channel_name = Parent Channel Name (not thread name)');
    logger.info('2. ✅ is_thread = true (clear thread indicator)');
    logger.info('3. ✅ thread_name = Actual thread name');
    logger.info('4. ✅ parent_channel_id = Parent channel ID');
    logger.info('5. ✅ parent_channel_name = Parent channel name');
    logger.info('6. ✅ channel_id = Thread channel ID (for Discord API)');
    logger.info('7. ✅ Statistics count towards parent channel');
    logger.info('8. ✅ Enhanced metadata includes thread_info object');
    logger.info('');
    logger.info('This ensures all thread messages are clearly identified as thread messages');
    logger.info('while maintaining the parent channel context for reporting and analytics.');
  }

  private async joinExistingThreads(channel: TextChannel, _channelConfig: ChannelConfig): Promise<void> {
    try {
      // Fetch existing threads in this channel with rate limiting
      const [activeThreads, archivedThreads] = await Promise.all([
        discordRateLimiter.executeWithRetry(
          () => channel.threads.fetchActive(),
          `fetch active threads from ${channel.name}`
        ) as Promise<any>,
        discordRateLimiter.executeWithRetry(
          () => channel.threads.fetchArchived({ fetchAll: false, limit: 50 }),
          `fetch archived threads from ${channel.name}`
        ) as Promise<any>
      ]);
      
      const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
      
      if (allThreads.length === 0) {
        logger.debug(`No existing threads found in ${channel.name}`);
        return;
      }

      logger.info(`🧵 Processing ${allThreads.length} existing threads in ${channel.name} with rate limiting`);

      let joinedCount = 0;
      let skippedCount = 0;

      // Process threads with rate limiting and error handling
      await discordRateLimiter.processBatch(
        allThreads,
        async (thread) => {
          logger.debug(`🧵 Processing thread: "${thread.name}" in ${channel.name}`);
          logger.debug(`   - Archived: ${thread.archived}`);
          logger.debug(`   - Already joined: ${thread.joined}`);
          
          // ✅ THREADS ARE NOT FILTERED BY PATTERNS - All threads in monitored channels are processed
          logger.debug(`   - Pattern filtering: DISABLED for threads (all threads processed)`);

          // Only join if not already joined and not archived
          if (!thread.joined && !thread.archived) {
            await thread.join();
            joinedCount++;
            logger.info(`🧵 ✅ JOINED existing thread: ${thread.name} in ${channel.name}`);
            return 'joined';
          } else if (thread.joined) {
            logger.debug(`🧵 Already in thread: ${thread.name} in ${channel.name}`);
            joinedCount++; // Count as joined since we're already in it
            return 'already_joined';
          } else if (thread.archived) {
            logger.debug(`🧵 SKIPPED archived thread: ${thread.name} in ${channel.name}`);
            skippedCount++;
            return 'skipped_archived';
          }
          
          return 'unknown';
        },
        3, // Small batch size for thread joins
        `join threads in ${channel.name}`
      );

      if (joinedCount > 0 || allThreads.length > 0) {
        logger.info(`🧵 Thread summary for ${channel.name}: ${joinedCount} joined, ${skippedCount} skipped, ${allThreads.length} total`);
      }
    } catch (error) {
      logger.error(`Error fetching/joining existing threads in ${channel.name}:`, error);
      throw error;
    }
  }

  private async joinExistingForumPosts(forumChannel: any, _channelConfig: ChannelConfig): Promise<void> {
    try {
      // Forum channels contain posts which are essentially threads
      logger.info(`🏛️ Processing forum channel: ${forumChannel.name} (posts are treated as threads)`);
      
      // Fetch existing posts/threads in this forum channel
      const activeThreads = await discordRateLimiter.executeWithRetry(
        () => forumChannel.threads.fetchActive(),
        `fetch active forum posts from ${forumChannel.name}`
      ) as any;
      
      const allPosts = [...activeThreads.threads.values()];
      
      if (allPosts.length === 0) {
        logger.debug(`No existing posts found in forum ${forumChannel.name}`);
        return;
      }

      logger.info(`🏛️ Processing ${allPosts.length} existing posts in forum ${forumChannel.name} with rate limiting`);

      let joinedCount = 0;
      let skippedCount = 0;

      // Process forum posts with rate limiting and error handling
      await discordRateLimiter.processBatch(
        allPosts,
        async (post) => {
          logger.debug(`🏛️ Processing forum post: "${post.name}" in ${forumChannel.name}`);
          logger.debug(`   - Archived: ${post.archived}`);
          logger.debug(`   - Already joined: ${post.joined}`);
          
          // ✅ FORUM POSTS ARE NOT FILTERED BY PATTERNS - All posts in monitored forums are processed
          logger.debug(`   - Pattern filtering: DISABLED for forum posts (all posts processed)`);

          // Only join if not already joined and not archived
          if (!post.joined && !post.archived) {
            await post.join();
            joinedCount++;
            logger.info(`🏛️ ✅ JOINED existing forum post: ${post.name} in ${forumChannel.name}`);
            return 'joined';
          } else if (post.joined) {
            logger.debug(`🏛️ Already in forum post: ${post.name} in ${forumChannel.name}`);
            joinedCount++; // Count as joined since we're already in it
            return 'already_joined';
          } else if (post.archived) {
            logger.debug(`🏛️ SKIPPED archived forum post: ${post.name} in ${forumChannel.name}`);
            skippedCount++;
            return 'skipped_archived';
          }
          
          return 'unknown';
        },
        3, // Small batch size for forum post joins
        `join forum posts in ${forumChannel.name}`
      );

      if (joinedCount > 0 || allPosts.length > 0) {
        logger.info(`🏛️ Forum post summary for ${forumChannel.name}: ${joinedCount} joined, ${skippedCount} skipped, ${allPosts.length} total`);
      }
    } catch (error) {
      logger.error(`Error fetching/joining existing forum posts in ${forumChannel.name}:`, error);
      throw error;
    }
  }

  private async handleThreadCreate(thread: any): Promise<void> {
    try {
      const parentChannel = thread.parent;
      if (!parentChannel || !this.channelConfigs.has(parentChannel.id)) {
        logger.debug(`🧵 Thread ${thread.name} parent channel not monitored - ignoring`);
        return;
      }

      logger.info(`🧵 New thread created: "${thread.name}" in monitored channel "${parentChannel.name}"`);
      logger.info(`   - Pattern filtering: DISABLED for threads (will be joined regardless of name)`);

      // CRITICAL: Bot must join threads to receive messages from them
      if (!thread.joined) {
        try {
          await discordRateLimiter.executeWithRetry(
            () => thread.join(),
            `join new thread ${thread.name}`
          );
          logger.info(`🧵 ✅ JOINED new thread: ${thread.name} (${thread.id}) in ${parentChannel.name}`);
        } catch (joinError) {
          logger.error(`❌ Failed to join new thread ${thread.name}:`, joinError);
          return;
        }
      } else {
        logger.info(`🧵 Already in new thread: ${thread.name} (${thread.id}) in ${parentChannel.name}`);
      }

      logger.info(`🧵 Now monitoring thread: ${thread.name} - messages will count towards parent channel "${parentChannel.name}" stats`);
    } catch (error) {
      logger.error('Error handling thread create:', error);
    }
  }

  private handleThreadDelete(thread: any): void {
    try {
      logger.info(`🧵 Thread deleted: ${thread.name} (${thread.id})`);
    } catch (error) {
      logger.error('Error handling thread delete:', error);
    }
  }

  private async handleThreadUpdate(oldThread: any, newThread: any): Promise<void> {
    try {
      // Handle thread archiving/unarchiving
      if (oldThread.archived !== newThread.archived) {
        if (newThread.archived) {
          logger.info(`🧵 Thread archived: ${newThread.name} (${newThread.id})`);
        } else {
          logger.info(`🧵 Thread unarchived: ${newThread.name} (${newThread.id})`);
        }
      }

      // Log name changes
      if (oldThread.name !== newThread.name) {
        logger.info(`🧵 Thread renamed: ${oldThread.name} → ${newThread.name} (${newThread.id})`);
      }
    } catch (error) {
      logger.error('Error handling thread update:', error);
    }
  }
}

export const discordService = new DiscordService(); 