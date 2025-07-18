-- =====================================================
-- BioSync RLS Policies Only
-- =====================================================
-- This script only enables RLS and creates policies for existing tables
-- Use this if your tables already exist and you just need to add policies

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on core tables
ALTER TABLE public.daos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dao_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dao_sync_stats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Discord tables
ALTER TABLE public.discord_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_channel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_user_activity ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Telegram tables
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

-- Policies for daos table
CREATE POLICY "Allow service inserts on daos" ON public.daos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on daos" ON public.daos
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on daos" ON public.daos
  FOR SELECT USING (true);

-- Policies for dao_sync_logs
CREATE POLICY "Allow service inserts on dao_sync_logs" ON public.dao_sync_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on dao_sync_logs" ON public.dao_sync_logs
  FOR SELECT USING (true);

-- Policies for dao_sync_stats
CREATE POLICY "Allow service inserts on dao_sync_stats" ON public.dao_sync_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on dao_sync_stats" ON public.dao_sync_stats
  FOR SELECT USING (true);

-- Policies for discord_messages
CREATE POLICY "Allow service inserts on discord_messages" ON public.discord_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on discord_messages" ON public.discord_messages
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on discord_messages" ON public.discord_messages
  FOR SELECT USING (true);

-- Policies for discord_channel_stats
CREATE POLICY "Allow service inserts on discord_channel_stats" ON public.discord_channel_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on discord_channel_stats" ON public.discord_channel_stats
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on discord_channel_stats" ON public.discord_channel_stats
  FOR SELECT USING (true);

-- Policies for discord_user_activity
CREATE POLICY "Allow service inserts on discord_user_activity" ON public.discord_user_activity
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on discord_user_activity" ON public.discord_user_activity
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on discord_user_activity" ON public.discord_user_activity
  FOR SELECT USING (true);

-- Policies for telegram_messages
CREATE POLICY "Allow service inserts on telegram_messages" ON public.telegram_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on telegram_messages" ON public.telegram_messages
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on telegram_messages" ON public.telegram_messages
  FOR SELECT USING (true);

-- Policies for telegram_chat_stats
CREATE POLICY "Allow service inserts on telegram_chat_stats" ON public.telegram_chat_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service updates on telegram_chat_stats" ON public.telegram_chat_stats
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on telegram_chat_stats" ON public.telegram_chat_stats
  FOR SELECT USING (true);

-- Policies for telegram_user_activity
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
    EXECUTE format('CREATE POLICY "Allow service inserts on account_%s_tweets" ON public.account_%s_tweets FOR INSERT WITH CHECK (true);', dao_name, dao_name);
    
    -- Update policy
    EXECUTE format('CREATE POLICY "Allow service updates on account_%s_tweets" ON public.account_%s_tweets FOR UPDATE USING (true) WITH CHECK (true);', dao_name, dao_name);
    
    -- Select policy
    EXECUTE format('CREATE POLICY "Allow public read on account_%s_tweets" ON public.account_%s_tweets FOR SELECT USING (true);', dao_name, dao_name);
  END LOOP;
END $$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'RLS policies created successfully for all tables!';
  RAISE NOTICE 'Your service can now insert data into all tables.';
  RAISE NOTICE 'Public read access has been enabled for all tables.';
END $$; 