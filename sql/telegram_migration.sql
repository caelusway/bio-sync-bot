-- Migration script to add Telegram functionality to existing Discord bot database
-- This script adds only the new Telegram-related tables and structures
-- Run this in your Supabase SQL Editor or via CLI

-- Create Telegram message category enum
CREATE TYPE telegram_message_category AS ENUM (
  'group',
  'channel',
  'private'
);

-- Create Telegram messages table
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

-- Create Telegram chat statistics table
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

-- Create Telegram user activity table
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

-- Create indexes for Telegram tables
CREATE INDEX idx_telegram_messages_chat_id ON telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_user_id ON telegram_messages(user_id);
CREATE INDEX idx_telegram_messages_timestamp ON telegram_messages(timestamp DESC);
CREATE INDEX idx_telegram_messages_category ON telegram_messages(category);
CREATE INDEX idx_telegram_messages_created_at ON telegram_messages(created_at DESC);

CREATE INDEX idx_telegram_chat_stats_category ON telegram_chat_stats(category);
CREATE INDEX idx_telegram_chat_stats_chat_type ON telegram_chat_stats(chat_type);

CREATE INDEX idx_telegram_user_activity_user_id ON telegram_user_activity(user_id);
CREATE INDEX idx_telegram_user_activity_chat_id ON telegram_user_activity(chat_id);
CREATE INDEX idx_telegram_user_activity_category ON telegram_user_activity(category);
CREATE INDEX idx_telegram_user_activity_last_message_at ON telegram_user_activity(last_message_at DESC);

-- Create triggers for Telegram tables (reuse existing update function)
CREATE TRIGGER update_telegram_messages_updated_at 
  BEFORE UPDATE ON telegram_messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_chat_stats_updated_at 
  BEFORE UPDATE ON telegram_chat_stats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_user_activity_updated_at 
  BEFORE UPDATE ON telegram_user_activity 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle Telegram user activity upserts
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

-- Verification queries (optional - run these to verify the migration worked)
-- SELECT 'telegram_messages' as table_name, count(*) as row_count FROM telegram_messages
-- UNION ALL
-- SELECT 'telegram_chat_stats' as table_name, count(*) as row_count FROM telegram_chat_stats
-- UNION ALL
-- SELECT 'telegram_user_activity' as table_name, count(*) as row_count FROM telegram_user_activity;

-- Show all tables to verify they exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name; 