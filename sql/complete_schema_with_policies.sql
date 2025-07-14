-- =====================================================
-- BioSync Database Schema with RLS Policies
-- =====================================================
-- This script creates all tables, enables RLS, and sets up insert policies
-- for the BioSync data collection system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- DAOs table
CREATE TABLE IF NOT EXISTS public.daos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  twitter_handle text,
  description text,
  website_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daos_pkey PRIMARY KEY (id)
);

-- DAO sync logs
CREATE TABLE IF NOT EXISTS public.dao_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service text NOT NULL,
  level integer NOT NULL,
  message text NOT NULL,
  data jsonb,
  error text,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  dao_sync_stats jsonb,
  CONSTRAINT dao_sync_logs_pkey PRIMARY KEY (id)
);

-- DAO sync stats
CREATE TABLE IF NOT EXISTS public.dao_sync_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service text NOT NULL,
  total_tweets_processed integer DEFAULT 0,
  tweets_updated integer DEFAULT 0,
  tweets_added integer DEFAULT 0,
  api_requests_used integer DEFAULT 0,
  sync_duration_ms integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dao_sync_stats_pkey PRIMARY KEY (id)
);

-- =====================================================
-- DISCORD TABLES
-- =====================================================

-- Discord messages
CREATE TABLE IF NOT EXISTS public.discord_messages (
  id text NOT NULL,
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  guild_id text NOT NULL,
  author_id text NOT NULL,
  author_username text NOT NULL,
  author_display_name text NOT NULL,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  embeds jsonb DEFAULT '[]'::jsonb,
  timestamp timestamp with time zone NOT NULL,
  edited_timestamp timestamp with time zone,
  message_type text NOT NULL,
  category text NOT NULL,
  discord_tge_phase text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_thread boolean DEFAULT false,
  thread_name text,
  parent_channel_id text,
  parent_channel_name text,
  CONSTRAINT discord_messages_pkey PRIMARY KEY (id)
);

-- Discord channel stats
CREATE TABLE IF NOT EXISTS public.discord_channel_stats (
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  category text NOT NULL,
  discord_tge_phase text NOT NULL,
  total_messages integer DEFAULT 0,
  messages_today integer DEFAULT 0,
  messages_this_week integer DEFAULT 0,
  last_message_at timestamp with time zone,
  active_users_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discord_channel_stats_pkey PRIMARY KEY (channel_id)
);

-- Discord user activity
CREATE TABLE IF NOT EXISTS public.discord_user_activity (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  username text NOT NULL,
  display_name text NOT NULL,
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  category text NOT NULL,
  discord_tge_phase text NOT NULL,
  message_count integer DEFAULT 1,
  last_message_at timestamp with time zone NOT NULL,
  first_message_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discord_user_activity_pkey PRIMARY KEY (id)
);

-- =====================================================
-- TELEGRAM TABLES
-- =====================================================

-- Telegram messages
CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id text NOT NULL,
  chat_id text NOT NULL,
  chat_title text NOT NULL,
  chat_type text NOT NULL,
  user_id text NOT NULL,
  username text,
  first_name text,
  last_name text,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  timestamp timestamp with time zone NOT NULL,
  edited_timestamp timestamp with time zone,
  message_type text NOT NULL,
  category text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  reply_to_message_id text,
  reply_to_user_id text,
  forward_from_chat_id text,
  forward_from_message_id text,
  forward_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_messages_pkey PRIMARY KEY (id)
);

-- Telegram chat stats
CREATE TABLE IF NOT EXISTS public.telegram_chat_stats (
  chat_id text NOT NULL,
  chat_title text NOT NULL,
  chat_type text NOT NULL,
  category text NOT NULL,
  total_messages integer DEFAULT 0,
  messages_today integer DEFAULT 0,
  messages_this_week integer DEFAULT 0,
  last_message_at timestamp with time zone,
  active_users_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_chat_stats_pkey PRIMARY KEY (chat_id)
);

-- Telegram user activity
CREATE TABLE IF NOT EXISTS public.telegram_user_activity (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  username text,
  first_name text,
  last_name text,
  chat_id text NOT NULL,
  chat_title text NOT NULL,
  category text NOT NULL,
  message_count integer DEFAULT 1,
  last_message_at timestamp with time zone NOT NULL,
  first_message_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT telegram_user_activity_pkey PRIMARY KEY (id)
);

-- =====================================================
-- DAO TWEET TABLES
-- =====================================================

-- Create tweet table function to avoid repetition
CREATE OR REPLACE FUNCTION create_dao_tweet_table(dao_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.dao_%s_tweets (
      id text NOT NULL,
      type text DEFAULT ''tweet''::text,
      url text,
      twitter_url text,
      text text,
      source text,
      retweet_count integer DEFAULT 0,
      reply_count integer DEFAULT 0,
      like_count integer DEFAULT 0,
      quote_count integer DEFAULT 0,
      view_count integer DEFAULT 0,
      bookmark_count integer DEFAULT 0,
      created_at timestamp with time zone,
      lang text,
      is_reply boolean DEFAULT false,
      in_reply_to_id text,
      conversation_id text,
      in_reply_to_user_id text,
      in_reply_to_username text,
      author_username text,
      author_name text,
      author_id text,
      mentions jsonb DEFAULT ''[]''::jsonb,
      hashtags jsonb DEFAULT ''[]''::jsonb,
      urls jsonb DEFAULT ''[]''::jsonb,
      media jsonb DEFAULT ''[]''::jsonb,
      raw_data jsonb,
      synced_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT dao_%s_tweets_pkey PRIMARY KEY (id)
    );
  ', dao_name, dao_name);
END;
$$ LANGUAGE plpgsql;

-- Create all DAO tweet tables
SELECT create_dao_tweet_table('athenadao');
SELECT create_dao_tweet_table('beeardai');
SELECT create_dao_tweet_table('bioprotocol');
SELECT create_dao_tweet_table('cerebrumdao');
SELECT create_dao_tweet_table('cryodao');
SELECT create_dao_tweet_table('curetopiadao');
SELECT create_dao_tweet_table('d1ckdao');
SELECT create_dao_tweet_table('dalyadao');
SELECT create_dao_tweet_table('dogyearsdao');
SELECT create_dao_tweet_table('fatdao');
SELECT create_dao_tweet_table('gingersciencedao');
SELECT create_dao_tweet_table('gliodao');
SELECT create_dao_tweet_table('hairdao');
SELECT create_dao_tweet_table('hempydotscience');
SELECT create_dao_tweet_table('kidneydao');
SELECT create_dao_tweet_table('longcovidlabsdao');
SELECT create_dao_tweet_table('mesoreefdao');
SELECT create_dao_tweet_table('microbiomedao');
SELECT create_dao_tweet_table('microdao');
SELECT create_dao_tweet_table('moleculedao');
SELECT create_dao_tweet_table('mycodao');
SELECT create_dao_tweet_table('nootropicsdao');
SELECT create_dao_tweet_table('psydao');
SELECT create_dao_tweet_table('quantumbiodao');
SELECT create_dao_tweet_table('reflexdao');
SELECT create_dao_tweet_table('sleepdao');
SELECT create_dao_tweet_table('spectruthaidao');
SELECT create_dao_tweet_table('spinedao');
SELECT create_dao_tweet_table('stemdao');
SELECT create_dao_tweet_table('valleydao');
SELECT create_dao_tweet_table('vitadao');
SELECT create_dao_tweet_table('vitafastbio');
SELECT create_dao_tweet_table('vitarnabio');

-- Drop the function after use
DROP FUNCTION create_dao_tweet_table(text);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.daos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dao_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dao_sync_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_channel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_chat_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_user_activity ENABLE ROW LEVEL SECURITY;

-- Enable RLS on all DAO tweet tables
DO $$
DECLARE
  dao_names text[] := ARRAY[
    'athenadao', 'beeardai', 'bioprotocol', 'cerebrumdao', 'cryodao', 'curetopiadao',
    'd1ckdao', 'dalyadao', 'dogyearsdao', 'fatdao', 'gingersciencedao', 'gliodao',
    'hairdao', 'hempydotscience', 'kidneydao', 'longcovidlabsdao', 'mesoreefdao',
    'microbiomedao', 'microdao', 'moleculedao', 'mycodao', 'nootropicsdao', 'psydao',
    'quantumbiodao', 'reflexdao', 'sleepdao', 'spectruthaidao', 'spinedao', 'stemdao',
    'valleydao', 'vitadao', 'vitafastbio', 'vitarnabio'
  ];
  dao_name text;
BEGIN
  FOREACH dao_name IN ARRAY dao_names
  LOOP
    EXECUTE format('ALTER TABLE public.dao_%s_tweets ENABLE ROW LEVEL SECURITY;', dao_name);
  END LOOP;
END $$;

-- =====================================================
-- CREATE INSERT POLICIES
-- =====================================================

-- Create service role for data collection
-- Note: You may need to adjust this based on your actual service authentication

-- Policy for daos table
CREATE POLICY "Allow service inserts on daos" ON public.daos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on daos" ON public.daos
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on daos" ON public.daos
  FOR SELECT USING (true);

-- Policy for dao_sync_logs
CREATE POLICY "Allow service inserts on dao_sync_logs" ON public.dao_sync_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on dao_sync_logs" ON public.dao_sync_logs
  FOR SELECT USING (true);

-- Policy for dao_sync_stats
CREATE POLICY "Allow service inserts on dao_sync_stats" ON public.dao_sync_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on dao_sync_stats" ON public.dao_sync_stats
  FOR SELECT USING (true);

-- Policy for discord_messages
CREATE POLICY "Allow service inserts on discord_messages" ON public.discord_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on discord_messages" ON public.discord_messages
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on discord_messages" ON public.discord_messages
  FOR SELECT USING (true);

-- Policy for discord_channel_stats
CREATE POLICY "Allow service inserts on discord_channel_stats" ON public.discord_channel_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on discord_channel_stats" ON public.discord_channel_stats
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on discord_channel_stats" ON public.discord_channel_stats
  FOR SELECT USING (true);

-- Policy for discord_user_activity
CREATE POLICY "Allow service inserts on discord_user_activity" ON public.discord_user_activity
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on discord_user_activity" ON public.discord_user_activity
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on discord_user_activity" ON public.discord_user_activity
  FOR SELECT USING (true);

-- Policy for telegram_messages
CREATE POLICY "Allow service inserts on telegram_messages" ON public.telegram_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on telegram_messages" ON public.telegram_messages
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on telegram_messages" ON public.telegram_messages
  FOR SELECT USING (true);

-- Policy for telegram_chat_stats
CREATE POLICY "Allow service inserts on telegram_chat_stats" ON public.telegram_chat_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on telegram_chat_stats" ON public.telegram_chat_stats
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on telegram_chat_stats" ON public.telegram_chat_stats
  FOR SELECT USING (true);

-- Policy for telegram_user_activity
CREATE POLICY "Allow service inserts on telegram_user_activity" ON public.telegram_user_activity
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on telegram_user_activity" ON public.telegram_user_activity
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on telegram_user_activity" ON public.telegram_user_activity
  FOR SELECT USING (true);

-- Policies for all DAO tweet tables
DO $$
DECLARE
  dao_names text[] := ARRAY[
    'athenadao', 'beeardai', 'bioprotocol', 'cerebrumdao', 'cryodao', 'curetopiadao',
    'd1ckdao', 'dalyadao', 'dogyearsdao', 'fatdao', 'gingersciencedao', 'gliodao',
    'hairdao', 'hempydotscience', 'kidneydao', 'longcovidlabsdao', 'mesoreefdao',
    'microbiomedao', 'microdao', 'moleculedao', 'mycodao', 'nootropicsdao', 'psydao',
    'quantumbiodao', 'reflexdao', 'sleepdao', 'spectruthaidao', 'spinedao', 'stemdao',
    'valleydao', 'vitadao', 'vitafastbio', 'vitarnabio'
  ];
  dao_name text;
BEGIN
  FOREACH dao_name IN ARRAY dao_names
  LOOP
    -- Insert policy
    EXECUTE format('CREATE POLICY "Allow service inserts on dao_%s_tweets" ON public.dao_%s_tweets FOR INSERT WITH CHECK (true);', dao_name, dao_name);
    
    -- Update policy
    EXECUTE format('CREATE POLICY "Allow service updates on dao_%s_tweets" ON public.dao_%s_tweets FOR UPDATE USING (true) WITH CHECK (true);', dao_name, dao_name);
    
    -- Select policy
    EXECUTE format('CREATE POLICY "Allow public read on dao_%s_tweets" ON public.dao_%s_tweets FOR SELECT USING (true);', dao_name, dao_name);
  END LOOP;
END $$;

-- =====================================================
-- CREATE PERFORMANCE INDEXES
-- =====================================================

-- Indexes for discord_messages
CREATE INDEX IF NOT EXISTS idx_discord_messages_channel_id ON public.discord_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_discord_messages_author_id ON public.discord_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_discord_messages_timestamp ON public.discord_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_discord_messages_category ON public.discord_messages(category);
CREATE INDEX IF NOT EXISTS idx_discord_messages_is_thread ON public.discord_messages(is_thread);

-- Indexes for discord_user_activity
CREATE INDEX IF NOT EXISTS idx_discord_user_activity_user_id ON public.discord_user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_user_activity_channel_id ON public.discord_user_activity(channel_id);
CREATE INDEX IF NOT EXISTS idx_discord_user_activity_category ON public.discord_user_activity(category);

-- Indexes for telegram_messages
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_id ON public.telegram_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_user_id ON public.telegram_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_timestamp ON public.telegram_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_category ON public.telegram_messages(category);

-- Indexes for telegram_user_activity
CREATE INDEX IF NOT EXISTS idx_telegram_user_activity_user_id ON public.telegram_user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_user_activity_chat_id ON public.telegram_user_activity(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_user_activity_category ON public.telegram_user_activity(category);

-- Indexes for dao_sync_logs
CREATE INDEX IF NOT EXISTS idx_dao_sync_logs_service ON public.dao_sync_logs(service);
CREATE INDEX IF NOT EXISTS idx_dao_sync_logs_timestamp ON public.dao_sync_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_dao_sync_logs_level ON public.dao_sync_logs(level);

-- Indexes for dao_sync_stats
CREATE INDEX IF NOT EXISTS idx_dao_sync_stats_service ON public.dao_sync_stats(service);
CREATE INDEX IF NOT EXISTS idx_dao_sync_stats_timestamp ON public.dao_sync_stats(timestamp);

-- Indexes for DAO tweet tables
DO $$
DECLARE
  dao_names text[] := ARRAY[
    'athenadao', 'beeardai', 'bioprotocol', 'cerebrumdao', 'cryodao', 'curetopiadao',
    'd1ckdao', 'dalyadao', 'dogyearsdao', 'fatdao', 'gingersciencedao', 'gliodao',
    'hairdao', 'hempydotscience', 'kidneydao', 'longcovidlabsdao', 'mesoreefdao',
    'microbiomedao', 'microdao', 'moleculedao', 'mycodao', 'nootropicsdao', 'psydao',
    'quantumbiodao', 'reflexdao', 'sleepdao', 'spectruthaidao', 'spinedao', 'stemdao',
    'valleydao', 'vitadao', 'vitafastbio', 'vitarnabio'
  ];
  dao_name text;
BEGIN
  FOREACH dao_name IN ARRAY dao_names
  LOOP
    -- Indexes for performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dao_%s_tweets_created_at ON public.dao_%s_tweets(created_at);', dao_name, dao_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dao_%s_tweets_author_id ON public.dao_%s_tweets(author_id);', dao_name, dao_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dao_%s_tweets_author_username ON public.dao_%s_tweets(author_username);', dao_name, dao_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dao_%s_tweets_is_reply ON public.dao_%s_tweets(is_reply);', dao_name, dao_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_dao_%s_tweets_synced_at ON public.dao_%s_tweets(synced_at);', dao_name, dao_name);
  END LOOP;
END $$;

-- =====================================================
-- CREATE USEFUL VIEWS
-- =====================================================

-- View for all tweet tables combined
CREATE OR REPLACE VIEW public.all_dao_tweets AS
SELECT 'athenadao' as dao_name, * FROM public.dao_athenadao_tweets
UNION ALL
SELECT 'beeardai' as dao_name, * FROM public.dao_beeardai_tweets
UNION ALL
SELECT 'bioprotocol' as dao_name, * FROM public.dao_bioprotocol_tweets
UNION ALL
SELECT 'cerebrumdao' as dao_name, * FROM public.dao_cerebrumdao_tweets
UNION ALL
SELECT 'cryodao' as dao_name, * FROM public.dao_cryodao_tweets
UNION ALL
SELECT 'curetopiadao' as dao_name, * FROM public.dao_curetopiadao_tweets
UNION ALL
SELECT 'd1ckdao' as dao_name, * FROM public.dao_d1ckdao_tweets
UNION ALL
SELECT 'dalyadao' as dao_name, * FROM public.dao_dalyadao_tweets
UNION ALL
SELECT 'dogyearsdao' as dao_name, * FROM public.dao_dogyearsdao_tweets
UNION ALL
SELECT 'fatdao' as dao_name, * FROM public.dao_fatdao_tweets
UNION ALL
SELECT 'gingersciencedao' as dao_name, * FROM public.dao_gingersciencedao_tweets
UNION ALL
SELECT 'gliodao' as dao_name, * FROM public.dao_gliodao_tweets
UNION ALL
SELECT 'hairdao' as dao_name, * FROM public.dao_hairdao_tweets
UNION ALL
SELECT 'hempydotscience' as dao_name, * FROM public.dao_hempydotscience_tweets
UNION ALL
SELECT 'kidneydao' as dao_name, * FROM public.dao_kidneydao_tweets
UNION ALL
SELECT 'longcovidlabsdao' as dao_name, * FROM public.dao_longcovidlabsdao_tweets
UNION ALL
SELECT 'mesoreefdao' as dao_name, * FROM public.dao_mesoreefdao_tweets
UNION ALL
SELECT 'microbiomedao' as dao_name, * FROM public.dao_microbiomedao_tweets
UNION ALL
SELECT 'microdao' as dao_name, * FROM public.dao_microdao_tweets
UNION ALL
SELECT 'moleculedao' as dao_name, * FROM public.dao_moleculedao_tweets
UNION ALL
SELECT 'mycodao' as dao_name, * FROM public.dao_mycodao_tweets
UNION ALL
SELECT 'nootropicsdao' as dao_name, * FROM public.dao_nootropicsdao_tweets
UNION ALL
SELECT 'psydao' as dao_name, * FROM public.dao_psydao_tweets
UNION ALL
SELECT 'quantumbiodao' as dao_name, * FROM public.dao_quantumbiodao_tweets
UNION ALL
SELECT 'reflexdao' as dao_name, * FROM public.dao_reflexdao_tweets
UNION ALL
SELECT 'sleepdao' as dao_name, * FROM public.dao_sleepdao_tweets
UNION ALL
SELECT 'spectruthaidao' as dao_name, * FROM public.dao_spectruthaidao_tweets
UNION ALL
SELECT 'spinedao' as dao_name, * FROM public.dao_spinedao_tweets
UNION ALL
SELECT 'stemdao' as dao_name, * FROM public.dao_stemdao_tweets
UNION ALL
SELECT 'valleydao' as dao_name, * FROM public.dao_valleydao_tweets
UNION ALL
SELECT 'vitadao' as dao_name, * FROM public.dao_vitadao_tweets
UNION ALL
SELECT 'vitafastbio' as dao_name, * FROM public.dao_vitafastbio_tweets
UNION ALL
SELECT 'vitarnabio' as dao_name, * FROM public.dao_vitarnabio_tweets;

-- View for recent activity across all platforms
CREATE OR REPLACE VIEW public.recent_activity AS
SELECT 
  'discord' as platform,
  channel_name as channel_or_chat,
  author_username as username,
  content,
  timestamp,
  category
FROM public.discord_messages
WHERE timestamp > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'telegram' as platform,
  chat_title as channel_or_chat,
  COALESCE(username, first_name) as username,
  content,
  timestamp,
  category
FROM public.telegram_messages
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to get tweet count for a specific DAO
CREATE OR REPLACE FUNCTION get_dao_tweet_count(dao_name text)
RETURNS integer AS $$
DECLARE
  count_result integer;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM public.dao_%s_tweets', dao_name) INTO count_result;
  RETURN count_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get all DAO names
CREATE OR REPLACE FUNCTION get_all_dao_names()
RETURNS text[] AS $$
BEGIN
  RETURN ARRAY[
    'athenadao', 'beeardai', 'bioprotocol', 'cerebrumdao', 'cryodao', 'curetopiadao',
    'd1ckdao', 'dalyadao', 'dogyearsdao', 'fatdao', 'gingersciencedao', 'gliodao',
    'hairdao', 'hempydotscience', 'kidneydao', 'longcovidlabsdao', 'mesoreefdao',
    'microbiomedao', 'microdao', 'moleculedao', 'mycodao', 'nootropicsdao', 'psydao',
    'quantumbiodao', 'reflexdao', 'sleepdao', 'spectruthaidao', 'spinedao', 'stemdao',
    'valleydao', 'vitadao', 'vitafastbio', 'vitarnabio'
  ];
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'BioSync database schema created successfully!';
  RAISE NOTICE 'Tables created: %', (
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'dao_%' 
    OR table_name LIKE 'discord_%' 
    OR table_name LIKE 'telegram_%'
    OR table_name = 'daos'
  );
  RAISE NOTICE 'RLS policies created for all tables';
  RAISE NOTICE 'Performance indexes created';
  RAISE NOTICE 'Utility views and functions created';
END $$; 