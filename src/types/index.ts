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

// ================================
// GROWTH TRACKING TYPES
// 🛡️ PRODUCTION SAFE: Only additive types, no changes to existing functionality
// ================================

export enum PlatformType {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  YOUTUBE = 'youtube',
  LINKEDIN = 'linkedin',
  LUMA = 'luma',
  EMAIL_NEWSLETTER = 'email_newsletter'
}

export enum MetricType {
  // Discord metrics
  DISCORD_MESSAGE_COUNT = 'discord_message_count',
  DISCORD_MEMBER_COUNT = 'discord_member_count',
  
  // Telegram metrics  
  TELEGRAM_MESSAGE_COUNT = 'telegram_message_count',
  TELEGRAM_MEMBER_COUNT = 'telegram_member_count',
  
  // YouTube metrics
  YOUTUBE_TOTAL_VIEWS = 'youtube_total_views',
  YOUTUBE_TOTAL_IMPRESSIONS = 'youtube_total_impressions',
  YOUTUBE_TOP_VIDEO_VIEWS = 'youtube_top_video_views',
  YOUTUBE_TOP_VIDEO_IMPRESSIONS = 'youtube_top_video_impressions',
  
  // LinkedIn metrics
  LINKEDIN_FOLLOWER_COUNT = 'linkedin_follower_count',
  
  // Luma metrics
  LUMA_PAGE_VIEWS = 'luma_page_views',
  LUMA_SUBSCRIBER_COUNT = 'luma_subscriber_count',
  
  // Email Newsletter metrics
  EMAIL_NEWSLETTER_SIGNUP_COUNT = 'email_newsletter_signup_count'
}

export interface GrowthMetric {
  id: string;
  platform: PlatformType;
  metric_type: MetricType;
  metric_value: number;
  metric_metadata: Record<string, any>;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export interface GrowthAnalytics {
  id: string;
  platform: PlatformType;
  metric_type: MetricType;
  current_value: number;
  previous_value: number;
  change_1d: number;
  change_7d: number;
  change_30d: number;
  change_1y: number;
  change_1d_percent: number;
  change_7d_percent: number;
  change_30d_percent: number;
  change_1y_percent: number;
  analytics_metadata: Record<string, any>;
  calculated_at: string;
  data_period_start: string;
  data_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface GrowthPlatformConfig {
  id: string;
  platform: PlatformType;
  collection_enabled: boolean;
  collection_interval_minutes: number;
  api_config: Record<string, any>;
  last_collected_at?: string;
  last_collection_status: 'pending' | 'success' | 'error';
  last_collection_error?: string;
  platform_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface YouTubeVideoData {
  title: string;
  video_id: string;
  url: string;
  views: number;
  impressions?: number;
  published_at: string;
  thumbnail_url?: string;
}

export interface YouTubeChannelData {
  total_views: number;
  total_impressions: number;
  subscriber_count: number;
  video_count: number;
  top_videos: YouTubeVideoData[];
}

export interface LinkedInPageData {
  follower_count: number;
  page_views?: number;
  engagement_rate?: number;
}

export interface LumaEventData {
  page_views: number;
  subscriber_count: number;
  event_count: number;
  total_attendees?: number;
}

export interface EmailNewsletterData {
  signup_count: number;
  total_subscribers?: number;
  recent_signups?: number;
  source_breakdown?: Record<string, number>;
}

export interface GrowthCollectionResult {
  platform: PlatformType;
  metrics_collected: Array<{
    metric_type: MetricType;
    value: number;
    metadata?: Record<string, any>;
  }>;
  collection_timestamp: string;
  success: boolean;
  error?: string;
}

export interface MarketingDashboardData {
  platform: PlatformType;
  metric_type: MetricType;
  current_value: number;
  change_1d: number;
  change_7d: number;
  change_30d: number;
  change_1y: number;
  change_1d_percent: number;
  change_7d_percent: number;
  change_30d_percent: number;
  change_1y_percent: number;
  calculated_at: string;
  trend_1d: 'up' | 'down' | 'stable';
  trend_7d: 'up' | 'down' | 'stable';
  trend_30d: 'up' | 'down' | 'stable';
} 