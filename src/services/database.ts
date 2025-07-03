import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DiscordMessage, ChannelStats, UserActivity, ServiceResponse } from '@/types';
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
}

export const databaseService = new DatabaseService(); 