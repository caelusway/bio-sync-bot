-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE discord_message_category AS ENUM (
  'core-general',
  'product', 
  'tech',
  'ai-agents',
  'ai',
  'design',
  'marketing',
  'tokenomics',
  'dao-program',
  'events',
  'other'
);

CREATE TYPE discord_tge_phase AS ENUM (
  'pre-tge',
  'post-tge'
);

-- Telegram message category (simpler since we follow all groups)
CREATE TYPE telegram_message_category AS ENUM (
  'group',
  'channel',
  'private'
);

-- Discord messages table
CREATE TABLE discord_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  embeds JSONB DEFAULT '[]'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL,
  edited_timestamp TIMESTAMPTZ,
  message_type TEXT NOT NULL,
  category discord_message_category NOT NULL,
  discord_tge_phase discord_tge_phase NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Thread support
  is_thread BOOLEAN DEFAULT FALSE,
  thread_name TEXT,
  parent_channel_id TEXT,
  parent_channel_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram messages table
CREATE TABLE telegram_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  chat_title TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL,
  edited_timestamp TIMESTAMPTZ,
  message_type TEXT NOT NULL,
  category telegram_message_category NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Reply support
  reply_to_message_id TEXT,
  reply_to_user_id TEXT,
  -- Forward support
  forward_from_chat_id TEXT,
  forward_from_message_id TEXT,
  forward_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channel statistics table
CREATE TABLE discord_channel_stats (
  channel_id TEXT PRIMARY KEY,
  channel_name TEXT NOT NULL,
  category discord_message_category NOT NULL,
  discord_tge_phase discord_tge_phase NOT NULL,
  total_messages INTEGER DEFAULT 0,
  messages_today INTEGER DEFAULT 0,
  messages_this_week INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  active_users_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram chat statistics table
CREATE TABLE telegram_chat_stats (
  chat_id TEXT PRIMARY KEY,
  chat_title TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  category telegram_message_category NOT NULL,
  total_messages INTEGER DEFAULT 0,
  messages_today INTEGER DEFAULT 0,
  messages_this_week INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  active_users_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity table
CREATE TABLE discord_user_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  category discord_message_category NOT NULL,
  discord_tge_phase discord_tge_phase NOT NULL,
  message_count INTEGER DEFAULT 1,
  last_message_at TIMESTAMPTZ NOT NULL,
  first_message_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

-- Telegram user activity table
CREATE TABLE telegram_user_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  chat_id TEXT NOT NULL,
  chat_title TEXT NOT NULL,
  category telegram_message_category NOT NULL,
  message_count INTEGER DEFAULT 1,
  last_message_at TIMESTAMPTZ NOT NULL,
  first_message_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chat_id)
);

-- Indexes for performance
CREATE INDEX idx_discord_messages_channel_id ON discord_messages(channel_id);
CREATE INDEX idx_discord_messages_author_id ON discord_messages(author_id);
CREATE INDEX idx_discord_messages_timestamp ON discord_messages(timestamp DESC);
CREATE INDEX idx_discord_messages_category ON discord_messages(category);
CREATE INDEX idx_discord_messages_discord_tge_phase ON discord_messages(discord_tge_phase);
CREATE INDEX idx_discord_messages_created_at ON discord_messages(created_at DESC);

CREATE INDEX idx_telegram_messages_chat_id ON telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_user_id ON telegram_messages(user_id);
CREATE INDEX idx_telegram_messages_timestamp ON telegram_messages(timestamp DESC);
CREATE INDEX idx_telegram_messages_category ON telegram_messages(category);
CREATE INDEX idx_telegram_messages_created_at ON telegram_messages(created_at DESC);

CREATE INDEX idx_discord_channel_stats_category ON discord_channel_stats(category);
CREATE INDEX idx_discord_channel_stats_discord_tge_phase ON discord_channel_stats(discord_tge_phase);

CREATE INDEX idx_telegram_chat_stats_category ON telegram_chat_stats(category);
CREATE INDEX idx_telegram_chat_stats_chat_type ON telegram_chat_stats(chat_type);

CREATE INDEX idx_discord_user_activity_user_id ON discord_user_activity(user_id);
CREATE INDEX idx_discord_user_activity_channel_id ON discord_user_activity(channel_id);
CREATE INDEX idx_discord_user_activity_category ON discord_user_activity(category);
CREATE INDEX idx_discord_user_activity_last_message_at ON discord_user_activity(last_message_at DESC);

CREATE INDEX idx_telegram_user_activity_user_id ON telegram_user_activity(user_id);
CREATE INDEX idx_telegram_user_activity_chat_id ON telegram_user_activity(chat_id);
CREATE INDEX idx_telegram_user_activity_category ON telegram_user_activity(category);
CREATE INDEX idx_telegram_user_activity_last_message_at ON telegram_user_activity(last_message_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_discord_messages_updated_at 
  BEFORE UPDATE ON discord_messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_messages_updated_at 
  BEFORE UPDATE ON telegram_messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discord_channel_stats_updated_at 
  BEFORE UPDATE ON discord_channel_stats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_chat_stats_updated_at 
  BEFORE UPDATE ON telegram_chat_stats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discord_user_activity_updated_at 
  BEFORE UPDATE ON discord_user_activity 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_user_activity_updated_at 
  BEFORE UPDATE ON telegram_user_activity 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle user activity upserts
CREATE OR REPLACE FUNCTION upsert_discord_user_activity(
  p_user_id TEXT,
  p_username TEXT,
  p_display_name TEXT,
  p_channel_id TEXT,
  p_channel_name TEXT,
  p_category discord_message_category,
  p_discord_tge_phase discord_tge_phase,
  p_message_timestamp TIMESTAMPTZ
)
RETURNS discord_user_activity AS $$
DECLARE
  result discord_user_activity;
BEGIN
  INSERT INTO discord_user_activity (
    user_id, username, display_name, channel_id, channel_name, 
    category, discord_tge_phase, message_count, last_message_at, first_message_at
  )
  VALUES (
    p_user_id, p_username, p_display_name, p_channel_id, p_channel_name,
    p_category, p_discord_tge_phase, 1, p_message_timestamp, p_message_timestamp
  )
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    channel_name = EXCLUDED.channel_name,
    category = EXCLUDED.category,
    discord_tge_phase = EXCLUDED.discord_tge_phase,
    message_count = discord_user_activity.message_count + 1,
    last_message_at = EXCLUDED.last_message_at,
    updated_at = NOW()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to handle Telegram user activity upserts
CREATE OR REPLACE FUNCTION upsert_telegram_user_activity(
  p_user_id TEXT,
  p_username TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_chat_id TEXT,
  p_chat_title TEXT,
  p_category telegram_message_category,
  p_message_timestamp TIMESTAMPTZ
)
RETURNS telegram_user_activity AS $$
DECLARE
  result telegram_user_activity;
BEGIN
  INSERT INTO telegram_user_activity (
    user_id, username, first_name, last_name, chat_id, chat_title, 
    category, message_count, last_message_at, first_message_at
  )
  VALUES (
    p_user_id, p_username, p_first_name, p_last_name, p_chat_id, p_chat_title,
    p_category, 1, p_message_timestamp, p_message_timestamp
  )
  ON CONFLICT (user_id, chat_id)
  DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    chat_title = EXCLUDED.chat_title,
    category = EXCLUDED.category,
    message_count = telegram_user_activity.message_count + 1,
    last_message_at = EXCLUDED.last_message_at,
    updated_at = NOW()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

