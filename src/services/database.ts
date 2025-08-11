import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  DiscordMessage, 
  ChannelStats, 
  UserActivity, 
  ServiceResponse, 
  TelegramMessage, 
  TelegramChatStats, 
  TelegramUserActivity,
  // Growth tracking types
  PlatformType,
  MetricType,
  GrowthMetric,
  GrowthAnalytics,
  GrowthPlatformConfig,
  MarketingDashboardData
} from '@/types';
import { botConfig } from '@/config/bot';
import { logger } from '@/utils/logger';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      botConfig.supabase.url,
      botConfig.supabase.anonKey
    );
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const { error } = await this.supabase.from('discord_messages').select('count', { count: 'exact', head: true });
      if (error) {
        throw error;
      }
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async saveMessage(message: Omit<DiscordMessage, 'created_at' | 'updated_at'>): Promise<ServiceResponse<DiscordMessage>> {
    try {
      // First, try to check if the message already exists
      const { data: existingMessage } = await this.supabase
        .from('discord_messages')
        .select('id, created_at')
        .eq('id', message.id)
        .single();

      const now = new Date().toISOString();
      
      if (existingMessage) {
        // Message exists, update it while preserving created_at
        const { data, error } = await this.supabase
          .from('discord_messages')
          .update({
            ...message,
            created_at: existingMessage.created_at, // Preserve original created_at
            updated_at: now
          })
          .eq('id', message.id)
          .select()
          .single();

        if (error) {
          logger.error('Failed to update existing message:', error);
          return { success: false, error: error.message, code: error.code };
        }

        logger.debug(`Message updated successfully: ${data.id}`);
        return { success: true, data };
      } else {
        // Message doesn't exist, insert it
        const { data, error } = await this.supabase
          .from('discord_messages')
          .insert([{
            ...message,
            created_at: now,
            updated_at: now
          }])
          .select()
          .single();

        if (error) {
          // Handle race condition where message might have been inserted between our check and insert
          if (error.code === '23505') { // Unique constraint violation
            logger.warn(`Message ${message.id} was inserted by another process, attempting update...`);
            
            // Try to update instead
            const { data: updateData, error: updateError } = await this.supabase
              .from('discord_messages')
              .update({
                ...message,
                updated_at: now
              })
              .eq('id', message.id)
              .select()
              .single();

            if (updateError) {
              logger.error('Failed to update message after race condition:', updateError);
              return { success: false, error: updateError.message, code: updateError.code };
            }

            logger.debug(`Message updated after race condition: ${updateData.id}`);
            return { success: true, data: updateData };
          }
          
          logger.error('Failed to insert new message:', error);
          return { success: false, error: error.message, code: error.code };
        }

        logger.debug(`Message inserted successfully: ${data.id}`);
        return { success: true, data };
      }
    } catch (error) {
      logger.error('Unexpected error saving message:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async updateMessage(messageId: string, updates: Partial<DiscordMessage>): Promise<ServiceResponse<DiscordMessage>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_messages')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update message:', error);
        return { success: false, error: error.message, code: error.code };
      }

      logger.debug(`Message updated successfully: ${messageId}`);
      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error updating message:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async deleteMessage(messageId: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await this.supabase
        .from('discord_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        logger.error('Failed to delete message:', error);
        return { success: false, error: error.message, code: error.code };
      }

      logger.debug(`Message deleted successfully: ${messageId}`);
      return { success: true };
    } catch (error) {
      logger.error('Unexpected error deleting message:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getChannelStats(channelId: string): Promise<ServiceResponse<ChannelStats>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_channel_stats')
        .select('*')
        .eq('channel_id', channelId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        logger.error('Failed to get channel stats:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || null };
    } catch (error) {
      logger.error('Unexpected error getting channel stats:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async updateChannelStats(stats: Omit<ChannelStats, 'updated_at'>): Promise<ServiceResponse<ChannelStats>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_channel_stats')
        .upsert({
          ...stats,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to update channel stats:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error updating channel stats:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async updateUserActivity(activity: Omit<UserActivity, 'updated_at'>): Promise<ServiceResponse<UserActivity>> {
    try {
      const { data, error } = await this.supabase
        .rpc('upsert_discord_user_activity', {
          p_user_id: activity.user_id,
          p_username: activity.username,
          p_display_name: activity.display_name,
          p_channel_id: activity.channel_id,
          p_channel_name: activity.channel_name,
          p_category: activity.category,
          p_discord_tge_phase: activity.discord_tge_phase,
          p_message_timestamp: activity.last_message_at
        }) as { data: UserActivity | null, error: any };

      if (error) {
        logger.error('Failed to update user activity:', error);
        return { success: false, error: error.message, code: error.code };
      }

      if (!data) {
        logger.error('No data returned from user activity upsert');
        return { success: false, error: 'No data returned from upsert operation' };
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error updating user activity:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getMessagesByChannel(channelId: string, limit = 100, offset = 0): Promise<ServiceResponse<DiscordMessage[]>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get messages by channel:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting messages by channel:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getMessagesByCategory(category: string, limit = 100, offset = 0): Promise<ServiceResponse<DiscordMessage[]>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_messages')
        .select('*')
        .eq('category', category)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get messages by category:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting messages by category:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async cleanupOldMessages(): Promise<ServiceResponse<{ deleted_count: number }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - botConfig.database.maxMessageAgeDays);

      const { data, error } = await this.supabase
        .from('discord_messages')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Failed to cleanup old messages:', error);
        return { success: false, error: error.message, code: error.code };
      }

      const deletedCount = Array.isArray(data) ? (data as any[]).length : (data ? 1 : 0);
      logger.info(`Cleaned up ${deletedCount} old messages`);
      return { success: true, data: { deleted_count: deletedCount } };
    } catch (error) {
      logger.error('Unexpected error cleaning up old messages:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getHealthStatus(): Promise<ServiceResponse<{ status: string; timestamp: string }>> {
    try {
      const { error } = await this.supabase
        .from('discord_messages')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { success: false, error: 'Database health check failed' };
    }
  }

  async getThreadMessages(limit = 10): Promise<ServiceResponse<DiscordMessage[]>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_messages')
        .select('*')
        .eq('is_thread', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get thread messages:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting thread messages:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getMessagesByParentChannel(parentChannelId: string, limit = 50): Promise<ServiceResponse<DiscordMessage[]>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_messages')
        .select('*')
        .eq('parent_channel_id', parentChannelId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get messages by parent channel:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting messages by parent channel:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  // Telegram methods
  async saveTelegramMessage(message: Omit<TelegramMessage, 'created_at' | 'updated_at'>): Promise<ServiceResponse<TelegramMessage>> {
    try {
      // First, try to check if the message already exists
      const { data: existingMessage } = await this.supabase
        .from('telegram_messages')
        .select('id, created_at')
        .eq('id', message.id)
        .single();

      const now = new Date().toISOString();
      
      if (existingMessage) {
        // Message exists, update it while preserving created_at
        const { data, error } = await this.supabase
          .from('telegram_messages')
          .update({
            ...message,
            created_at: existingMessage.created_at, // Preserve original created_at
            updated_at: now
          })
          .eq('id', message.id)
          .select()
          .single();

        if (error) {
          logger.error('Failed to update existing Telegram message:', error);
          return { success: false, error: error.message, code: error.code };
        }

        logger.debug(`Telegram message updated successfully: ${data.id}`);
        return { success: true, data };
      } else {
        // Message doesn't exist, insert it
        const { data, error } = await this.supabase
          .from('telegram_messages')
          .insert([{
            ...message,
            created_at: now,
            updated_at: now
          }])
          .select()
          .single();

        if (error) {
          // Handle race condition where message might have been inserted between our check and insert
          if (error.code === '23505') { // Unique constraint violation
            logger.warn(`Telegram message ${message.id} was inserted by another process, attempting update...`);
            
            // Try to update instead
            const { data: updateData, error: updateError } = await this.supabase
              .from('telegram_messages')
              .update({
                ...message,
                updated_at: now
              })
              .eq('id', message.id)
              .select()
              .single();

            if (updateError) {
              logger.error('Failed to update Telegram message after race condition:', updateError);
              return { success: false, error: updateError.message, code: updateError.code };
            }

            logger.debug(`Telegram message updated after race condition: ${updateData.id}`);
            return { success: true, data: updateData };
          }
          
          logger.error('Failed to insert new Telegram message:', error);
          return { success: false, error: error.message, code: error.code };
        }

        logger.debug(`Telegram message inserted successfully: ${data.id}`);
        return { success: true, data };
      }
    } catch (error) {
      logger.error('Unexpected error saving Telegram message:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async updateTelegramMessage(messageId: string, updates: Partial<TelegramMessage>): Promise<ServiceResponse<TelegramMessage>> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_messages')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update Telegram message:', error);
        return { success: false, error: error.message, code: error.code };
      }

      logger.debug(`Telegram message updated successfully: ${messageId}`);
      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error updating Telegram message:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async deleteTelegramMessage(messageId: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await this.supabase
        .from('telegram_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        logger.error('Failed to delete Telegram message:', error);
        return { success: false, error: error.message, code: error.code };
      }

      logger.debug(`Telegram message deleted successfully: ${messageId}`);
      return { success: true };
    } catch (error) {
      logger.error('Unexpected error deleting Telegram message:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getTelegramChatStats(chatId: string): Promise<ServiceResponse<TelegramChatStats>> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_chat_stats')
        .select('*')
        .eq('chat_id', chatId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        logger.error('Failed to get Telegram chat stats:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || null };
    } catch (error) {
      logger.error('Unexpected error getting Telegram chat stats:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async updateTelegramChatStats(stats: Omit<TelegramChatStats, 'updated_at'>): Promise<ServiceResponse<TelegramChatStats>> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_chat_stats')
        .upsert({
          ...stats,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to update Telegram chat stats:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error updating Telegram chat stats:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async updateTelegramUserActivity(activity: Omit<TelegramUserActivity, 'updated_at'>): Promise<ServiceResponse<TelegramUserActivity>> {
    try {
      const { data, error } = await this.supabase
        .rpc('upsert_telegram_user_activity', {
          p_user_id: activity.user_id,
          p_username: activity.username,
          p_first_name: activity.first_name,
          p_last_name: activity.last_name,
          p_chat_id: activity.chat_id,
          p_chat_title: activity.chat_title,
          p_category: activity.category,
          p_message_timestamp: activity.last_message_at
        }) as { data: TelegramUserActivity | null, error: any };

      if (error) {
        logger.error('Failed to update Telegram user activity:', error);
        return { success: false, error: error.message, code: error.code };
      }

      if (!data) {
        logger.error('No data returned from Telegram user activity upsert');
        return { success: false, error: 'No data returned from upsert operation' };
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error updating Telegram user activity:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getTelegramMessagesByChat(chatId: string, limit = 100, offset = 0): Promise<ServiceResponse<TelegramMessage[]>> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get Telegram messages by chat:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting Telegram messages by chat:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async getTelegramMessagesByCategory(category: string, limit = 100, offset = 0): Promise<ServiceResponse<TelegramMessage[]>> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_messages')
        .select('*')
        .eq('category', category)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get Telegram messages by category:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting Telegram messages by category:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  async cleanupOldTelegramMessages(): Promise<ServiceResponse<{ deleted_count: number }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - botConfig.database.maxMessageAgeDays);

      const { data, error } = await this.supabase
        .from('telegram_messages')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Failed to cleanup old Telegram messages:', error);
        return { success: false, error: error.message, code: error.code };
      }

      const deletedCount = Array.isArray(data) ? (data as any[]).length : (data ? 1 : 0);
      logger.info(`Cleaned up ${deletedCount} old Telegram messages`);
      return { success: true, data: { deleted_count: deletedCount } };
    } catch (error) {
      logger.error('Unexpected error cleaning up old Telegram messages:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  // ================================
  // GROWTH TRACKING METHODS
  // 🛡️ PRODUCTION SAFE: Only additive methods, no changes to existing functionality
  // ================================

  /**
   * Get total Discord message count (for growth tracking)
   */
  async getDiscordTotalMessageCount(): Promise<ServiceResponse<{ count: number }>> {
    try {
      const { count, error } = await this.supabase
        .from('discord_messages')
        .select('*', { count: 'exact', head: true });

      if (error) {
        logger.error('Failed to get Discord total message count:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { count: count || 0 } };
    } catch (error) {
      logger.error('Unexpected error getting Discord total message count:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get unique Discord member count (for growth tracking)
   */
  async getDiscordUniqueMemberCount(): Promise<ServiceResponse<{ count: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('discord_messages')
        .select('author_id')
        .not('author_id', 'is', null);

      if (error) {
        logger.error('Failed to get Discord unique member count:', error);
        return { success: false, error: error.message, code: error.code };
      }

      // Count unique author IDs
      const uniqueAuthors = new Set((data || []).map(row => row.author_id));
      
      return { success: true, data: { count: uniqueAuthors.size } };
    } catch (error) {
      logger.error('Unexpected error getting Discord unique member count:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get total Telegram message count (for growth tracking)
   */
  async getTelegramTotalMessageCount(): Promise<ServiceResponse<{ count: number }>> {
    try {
      const { count, error } = await this.supabase
        .from('telegram_messages')
        .select('*', { count: 'exact', head: true });

      if (error) {
        logger.error('Failed to get Telegram total message count:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { count: count || 0 } };
    } catch (error) {
      logger.error('Unexpected error getting Telegram total message count:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get unique Telegram member count (for growth tracking)
   */
  async getTelegramUniqueMemberCount(): Promise<ServiceResponse<{ count: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_messages')
        .select('user_id')
        .not('user_id', 'is', null);

      if (error) {
        logger.error('Failed to get Telegram unique member count:', error);
        return { success: false, error: error.message, code: error.code };
      }

      // Count unique user IDs
      const uniqueUsers = new Set((data || []).map(row => row.user_id));
      
      return { success: true, data: { count: uniqueUsers.size } };
    } catch (error) {
      logger.error('Unexpected error getting Telegram unique member count:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Save growth metric data
   */
  async saveGrowthMetric(metric: Omit<GrowthMetric, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResponse<GrowthMetric>> {
    try {
      const { data, error } = await this.supabase
        .rpc('upsert_growth_metric', {
          p_platform: metric.platform,
          p_metric_type: metric.metric_type,
          p_metric_value: metric.metric_value,
          p_metric_metadata: metric.metric_metadata,
          p_recorded_at: metric.recorded_at
        });

      if (error) {
        logger.error('Failed to save growth metric:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error saving growth metric:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Calculate growth analytics for a platform and metric
   */
  async calculateGrowthAnalytics(platform: PlatformType, metricType: MetricType, calculationDate?: string): Promise<ServiceResponse<GrowthAnalytics>> {
    try {
      const { data, error } = await this.supabase
        .rpc('calculate_growth_analytics', {
          p_platform: platform,
          p_metric_type: metricType,
          p_calculation_date: calculationDate || new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to calculate growth analytics:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Unexpected error calculating growth analytics:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get marketing dashboard data
   */
  async getMarketingDashboardData(): Promise<ServiceResponse<MarketingDashboardData[]>> {
    try {
      const { data, error } = await this.supabase
        .from('v_marketing_dashboard')
        .select('*')
        .order('platform, metric_type');

      if (error) {
        logger.error('Failed to get marketing dashboard data:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting marketing dashboard data:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get growth analytics for a specific platform
   */
  async getPlatformGrowthAnalytics(platform: PlatformType): Promise<ServiceResponse<GrowthAnalytics[]>> {
    try {
      const { data, error } = await this.supabase
        .from('growth_analytics')
        .select('*')
        .eq('platform', platform)
        .order('metric_type, calculated_at', { ascending: false });

      if (error) {
        logger.error(`Failed to get growth analytics for ${platform}:`, error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error(`Unexpected error getting growth analytics for ${platform}:`, error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get growth platform configurations
   */
  async getGrowthPlatformConfigs(): Promise<ServiceResponse<GrowthPlatformConfig[]>> {
    try {
      const { data, error } = await this.supabase
        .from('growth_platform_configs')
        .select('*')
        .order('platform');

      if (error) {
        logger.error('Failed to get growth platform configs:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting growth platform configs:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Update platform collection status
   */
  async updateGrowthPlatformCollectionStatus(
    platform: PlatformType, 
    status: 'pending' | 'success' | 'error', 
    error?: string
  ): Promise<ServiceResponse<GrowthPlatformConfig>> {
    try {
      const updateData: any = {
        last_collection_status: status,
        last_collected_at: new Date().toISOString()
      };

      if (error) {
        updateData.last_collection_error = error;
      }

      const { data, error: updateError } = await this.supabase
        .from('growth_platform_configs')
        .update(updateData)
        .eq('platform', platform)
        .select()
        .single();

      if (updateError) {
        logger.error(`Failed to update collection status for ${platform}:`, updateError);
        return { success: false, error: updateError.message, code: updateError.code };
      }

      return { success: true, data };
    } catch (error) {
      logger.error(`Unexpected error updating collection status for ${platform}:`, error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get latest growth metrics (for quick dashboard queries)
   */
  async getLatestGrowthMetrics(): Promise<ServiceResponse<GrowthMetric[]>> {
    try {
      const { data, error } = await this.supabase
        .from('v_latest_growth_metrics')
        .select('*')
        .order('platform, metric_type');

      if (error) {
        logger.error('Failed to get latest growth metrics:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting latest growth metrics:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get growth summary using database function
   */
  async getGrowthSummary(): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_growth_summary');

      if (error) {
        logger.error('Failed to get growth summary:', error);
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      logger.error('Unexpected error getting growth summary:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }
}

export const databaseService = new DatabaseService(); 