export interface DiscordMessage {
  id: string;
  channel_id: string;
  channel_name: string;
  guild_id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  content: string;
  attachments: MessageAttachment[];
  embeds: MessageEmbed[];
  timestamp: string;
  edited_timestamp?: string;
  message_type: string;
  category: MessageCategory;
  discord_tge_phase: TGEPhase;
  metadata: Record<string, any>;
  // Thread support
  is_thread: boolean;
  thread_name?: string;
  parent_channel_id?: string;
  parent_channel_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TelegramMessage {
  id: string;
  chat_id: string;
  chat_title: string;
  chat_type: string;
  user_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  content?: string;
  attachments: TelegramAttachment[];
  timestamp: string;
  edited_timestamp?: string;
  message_type: string;
  category: TelegramMessageCategory;
  metadata: Record<string, any>;
  // Reply support
  reply_to_message_id?: string;
  reply_to_user_id?: string;
  // Forward support
  forward_from_chat_id?: string;
  forward_from_message_id?: string;
  forward_date?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  content_type: string | undefined;
  width: number | undefined;
  height: number | undefined;
}

export interface TelegramAttachment {
  type: 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'animation' | 'video_note';
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_name?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumb?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  };
}

export interface MessageEmbed {
  title: string | undefined;
  description: string | undefined;
  url: string | undefined;
  color: number | undefined;
  timestamp: string | undefined;
  footer: {
    text: string;
    icon_url: string | undefined;
  } | undefined;
  image: {
    url: string;
    width: number | undefined;
    height: number | undefined;
  } | undefined;
  author: {
    name: string;
    url: string | undefined;
    icon_url: string | undefined;
  } | undefined;
  fields: Array<{
    name: string;
    value: string;
    inline: boolean | undefined;
  }>;
}

export enum MessageCategory {
  CORE_GENERAL = 'core-general',
  PRODUCT = 'product',
  TECH = 'tech',
  AI_AGENTS = 'ai-agents',
  AI = 'ai',
  DESIGN = 'design',
  MARKETING = 'marketing',
  TOKENOMICS = 'tokenomics',
  DAO_PROGRAM = 'dao-program',
  EVENTS = 'events',
  OTHER = 'other'
}

export enum TelegramMessageCategory {
  GROUP = 'group',
  CHANNEL = 'channel',
  PRIVATE = 'private'
}

export enum TGEPhase {
  PRE_TGE = 'pre-tge',
  POST_TGE = 'post-tge'
}

export interface CategoryConfig {
  id: string;
  name: string;
  message_category: MessageCategory;
  tge_phase: TGEPhase;
  monitoring_enabled: boolean;
  include_patterns?: string[]; // Channel name patterns to include
  exclude_patterns?: string[]; // Channel name patterns to exclude
  filters?: MessageFilter[];
}

export interface ChannelConfig {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  category: MessageCategory;
  tge_phase: TGEPhase;
  monitoring_enabled: boolean;
  filters: MessageFilter[];
}

export interface TelegramChatConfig {
  id: string;
  title: string;
  type: string;
  category: TelegramMessageCategory;
  monitoring_enabled: boolean;
  filters: MessageFilter[];
}

export interface MessageFilter {
  type: 'content' | 'author' | 'attachment' | 'embed';
  condition: 'contains' | 'equals' | 'regex' | 'exists';
  value?: string;
  exclude?: boolean;
}

export interface BotConfig {
  discord: {
    token: string;
    clientId: string;
    guildId: string;
  };
  telegram: {
    token: string;
    webhook_url?: string;
    polling: boolean;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  categories: CategoryConfig[];
  channels: ChannelConfig[]; // This will be populated dynamically
  telegramChats: TelegramChatConfig[]; // This will be populated dynamically
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
  };
  health: {
    checkInterval: number;
  };
  database: {
    cleanupInterval: number;
    maxMessageAgeDays: number;
  };
}

export interface DatabaseRow {
  id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChannelStats {
  channel_id: string;
  channel_name: string;
  category: MessageCategory;
  discord_tge_phase: TGEPhase;
  total_messages: number;
  messages_today: number;
  messages_this_week: number;
  last_message_at?: string;
  active_users_count: number;
  updated_at: string;
}

export interface TelegramChatStats {
  chat_id: string;
  chat_title: string;
  chat_type: string;
  category: TelegramMessageCategory;
  total_messages: number;
  messages_today: number;
  messages_this_week: number;
  last_message_at?: string;
  active_users_count: number;
  updated_at: string;
}

export interface UserActivity {
  user_id: string;
  username: string;
  display_name: string;
  channel_id: string;
  channel_name: string;
  category: MessageCategory;
  discord_tge_phase: TGEPhase;
  message_count: number;
  last_message_at: string;
  first_message_at: string;
  updated_at: string;
}

export interface TelegramUserActivity {
  user_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  chat_id: string;
  chat_title: string;
  category: TelegramMessageCategory;
  message_count: number;
  last_message_at: string;
  first_message_at: string;
  updated_at: string;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
} 