-- BioProtocol Growth Tracking - Initial Data Seeding
-- 🛡️ PRODUCTION SAFE: Only inserts initial configuration data
-- Run this AFTER growth_tracking_schema.sql

-- Initialize growth tracking starting fresh from today
-- All metrics will start from 0 and be populated by API data collection
DO $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
BEGIN
  -- Log the initialization
  RAISE NOTICE 'Growth tracking initialized for fresh start from: %', current_time;
  RAISE NOTICE 'All metrics will start from 0 and be populated by API data collection';
END;
$$;

-- Insert initial 0 values for all platforms starting fresh
-- This ensures the dashboard shows all platforms with clean starting point
INSERT INTO growth_metrics (platform, metric_type, metric_value, recorded_at, metric_metadata)
VALUES 
  -- Discord metrics (starting from 0, will be populated by API)
  ('discord', 'discord_message_count', 0, NOW(),
   '{"source": "fresh_start", "description": "Discord message count - starting fresh, will be populated by API"}'::jsonb),
  ('discord', 'discord_member_count', 0, NOW(),
   '{"source": "fresh_start", "description": "Discord member count - starting fresh, will be populated by API"}'::jsonb),
   
  -- Telegram metrics (starting from 0, will be populated by API)
  ('telegram', 'telegram_message_count', 0, NOW(),
   '{"source": "fresh_start", "description": "Telegram message count - starting fresh, will be populated by API"}'::jsonb),
  ('telegram', 'telegram_member_count', 0, NOW(),
   '{"source": "fresh_start", "description": "Telegram member count - starting fresh, will be populated by API"}'::jsonb),
   
  -- YouTube metrics (starting from 0, will be populated by API)
  ('youtube', 'youtube_total_views', 0, NOW(),
   '{"source": "fresh_start", "description": "YouTube total views - starting fresh, will be populated by API"}'::jsonb),
  ('youtube', 'youtube_total_impressions', 0, NOW(),
   '{"source": "fresh_start", "description": "YouTube total impressions - starting fresh, will be populated by API"}'::jsonb),
  ('youtube', 'youtube_top_video_views', 0, NOW(),
   '{"source": "fresh_start", "description": "Top video views - starting fresh, will be populated by API"}'::jsonb),
  ('youtube', 'youtube_top_video_impressions', 0, NOW(),
   '{"source": "fresh_start", "description": "Top video impressions - starting fresh, will be populated by API"}'::jsonb),
  
  -- LinkedIn metrics (starting from 0, will be populated by API)
  ('linkedin', 'linkedin_follower_count', 0, NOW(),
   '{"source": "fresh_start", "description": "LinkedIn followers - starting fresh, will be populated by API"}'::jsonb),
  
  -- Luma metrics (starting from 0, will be populated by API)
  ('luma', 'luma_page_views', 0, NOW(),
   '{"source": "fresh_start", "description": "Luma page views - starting fresh, will be populated by API"}'::jsonb),
  ('luma', 'luma_subscriber_count', 0, NOW(),
   '{"source": "fresh_start", "description": "Luma subscribers - starting fresh, will be populated by API"}'::jsonb),
  
  -- Email Newsletter metrics (starting from 0, will be populated by API)
  ('email_newsletter', 'email_newsletter_signup_count', 0, NOW(),
   '{"source": "fresh_start", "description": "Email newsletter signups - starting fresh, will be populated by API"}'::jsonb)
ON CONFLICT (platform, metric_type, recorded_at) DO NOTHING;

-- Calculate initial analytics for all platforms (starting with all 0 values)
SELECT calculate_growth_analytics(platform, metric_type, NOW())
FROM (VALUES 
  ('discord'::platform_type, 'discord_message_count'::metric_type),
  ('discord'::platform_type, 'discord_member_count'::metric_type),
  ('telegram'::platform_type, 'telegram_message_count'::metric_type),
  ('telegram'::platform_type, 'telegram_member_count'::metric_type),
  ('youtube'::platform_type, 'youtube_total_views'::metric_type),
  ('youtube'::platform_type, 'youtube_total_impressions'::metric_type),
  ('youtube'::platform_type, 'youtube_top_video_views'::metric_type),
  ('youtube'::platform_type, 'youtube_top_video_impressions'::metric_type),
  ('linkedin'::platform_type, 'linkedin_follower_count'::metric_type),
  ('luma'::platform_type, 'luma_page_views'::metric_type),
  ('luma'::platform_type, 'luma_subscriber_count'::metric_type),
  ('email_newsletter'::platform_type, 'email_newsletter_signup_count'::metric_type)
) AS metrics(platform, metric_type);

-- Verify the setup
SELECT 
  'Growth tracking setup complete!' as status,
  COUNT(*) as total_metrics,
  COUNT(DISTINCT platform) as platforms_configured,
  COUNT(DISTINCT metric_type) as metric_types_available
FROM growth_metrics;

-- Show current summary
SELECT * FROM v_marketing_dashboard ORDER BY platform, metric_type;