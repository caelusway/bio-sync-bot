-- BioProtocol Growth Tracking Schema
-- This schema adds growth tracking capabilities without affecting existing functionality
-- 🛡️ PRODUCTION SAFE: Only adds new tables, no modifications to existing ones

-- Enable UUID extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create platform enum type
CREATE TYPE platform_type AS ENUM (
  'discord',
  'telegram',
  'youtube',
  'linkedin',
  'luma',
  'email_newsletter'
);

-- Create metric type enum
CREATE TYPE metric_type AS ENUM (
  -- Discord metrics
  'discord_message_count',
  'discord_member_count',
  
  -- Telegram metrics
  'telegram_message_count',
  'telegram_member_count',
  
  -- YouTube metrics
  'youtube_total_views',
  'youtube_total_impressions',
  'youtube_top_video_views',
  'youtube_top_video_impressions',
  
  -- LinkedIn metrics
  'linkedin_follower_count',
  
  -- Luma metrics
  'luma_page_views',
  'luma_subscriber_count',
  
  -- Email Newsletter metrics
  'email_newsletter_signup_count'
);

-- Main growth metrics table
CREATE TABLE growth_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  platform platform_type NOT NULL,
  metric_type metric_type NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  metric_metadata JSONB DEFAULT '{}'::jsonb, -- Store additional data like top video info
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure we don't have duplicate metrics for the same time period
  UNIQUE(platform, metric_type, recorded_at)
);

-- Growth analytics table for storing calculated changes
CREATE TABLE growth_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  platform platform_type NOT NULL,
  metric_type metric_type NOT NULL,
  
  -- Current values
  current_value BIGINT NOT NULL DEFAULT 0,
  previous_value BIGINT NOT NULL DEFAULT 0,
  
  -- Change calculations
  change_1d BIGINT DEFAULT 0,
  change_7d BIGINT DEFAULT 0,
  change_30d BIGINT DEFAULT 0,
  change_1y BIGINT DEFAULT 0,
  
  -- Percentage changes
  change_1d_percent DECIMAL(10,2) DEFAULT 0,
  change_7d_percent DECIMAL(10,2) DEFAULT 0,
  change_30d_percent DECIMAL(10,2) DEFAULT 0,
  change_1y_percent DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata for additional context
  analytics_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Time tracking
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  data_period_start TIMESTAMPTZ NOT NULL,
  data_period_end TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique analytics per platform/metric/date
  UNIQUE(platform, metric_type, calculated_date)
);

-- Platform configuration table for managing data collection settings
CREATE TABLE growth_platform_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  platform platform_type NOT NULL UNIQUE,
  
  -- Collection settings
  collection_enabled BOOLEAN DEFAULT true,
  collection_interval_minutes INTEGER DEFAULT 60, -- How often to collect data
  
  -- API configuration (encrypted/hashed in production)
  api_config JSONB DEFAULT '{}'::jsonb,
  
  -- Last collection info
  last_collected_at TIMESTAMPTZ,
  last_collection_status TEXT DEFAULT 'pending', -- pending, success, error
  last_collection_error TEXT,
  
  -- Metadata
  platform_metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX idx_growth_metrics_platform ON growth_metrics(platform);
CREATE INDEX idx_growth_metrics_metric_type ON growth_metrics(metric_type);
CREATE INDEX idx_growth_metrics_recorded_at ON growth_metrics(recorded_at DESC);
CREATE INDEX idx_growth_metrics_platform_metric_recorded ON growth_metrics(platform, metric_type, recorded_at DESC);

CREATE INDEX idx_growth_analytics_platform ON growth_analytics(platform);
CREATE INDEX idx_growth_analytics_metric_type ON growth_analytics(metric_type);
CREATE INDEX idx_growth_analytics_calculated_at ON growth_analytics(calculated_at DESC);
CREATE INDEX idx_growth_analytics_platform_metric_calculated ON growth_analytics(platform, metric_type, calculated_at DESC);

-- Additional index on calculated_date for performance
CREATE INDEX idx_growth_analytics_calculated_date ON growth_analytics(calculated_date DESC);

CREATE INDEX idx_growth_platform_configs_platform ON growth_platform_configs(platform);
CREATE INDEX idx_growth_platform_configs_collection_enabled ON growth_platform_configs(collection_enabled);
CREATE INDEX idx_growth_platform_configs_last_collected_at ON growth_platform_configs(last_collected_at DESC);

-- Trigger for updated_at timestamps
CREATE TRIGGER update_growth_metrics_updated_at 
  BEFORE UPDATE ON growth_metrics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_growth_analytics_updated_at 
  BEFORE UPDATE ON growth_analytics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_growth_platform_configs_updated_at 
  BEFORE UPDATE ON growth_platform_configs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to safely insert growth metrics with deduplication
CREATE OR REPLACE FUNCTION upsert_growth_metric(
  p_platform platform_type,
  p_metric_type metric_type,
  p_metric_value BIGINT,
  p_metric_metadata JSONB DEFAULT '{}'::jsonb,
  p_recorded_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS growth_metrics AS $$
DECLARE
  result growth_metrics;
BEGIN
  INSERT INTO growth_metrics (
    platform, metric_type, metric_value, metric_metadata, recorded_at
  )
  VALUES (
    p_platform, p_metric_type, p_metric_value, p_metric_metadata, p_recorded_at
  )
  ON CONFLICT (platform, metric_type, recorded_at)
  DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    metric_metadata = EXCLUDED.metric_metadata,
    updated_at = NOW()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate growth analytics for a specific platform and metric
CREATE OR REPLACE FUNCTION calculate_growth_analytics(
  p_platform platform_type,
  p_metric_type metric_type,
  p_calculation_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS growth_analytics AS $$
DECLARE
  current_val BIGINT := 0;
  val_1d BIGINT := 0;
  val_7d BIGINT := 0;
  val_30d BIGINT := 0;
  val_1y BIGINT := 0;
  result growth_analytics;
BEGIN
  -- Get current value (most recent)
  SELECT COALESCE(metric_value, 0) INTO current_val
  FROM growth_metrics
  WHERE platform = p_platform 
    AND metric_type = p_metric_type
    AND recorded_at <= p_calculation_date
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Get value from 1 day ago
  SELECT COALESCE(metric_value, 0) INTO val_1d
  FROM growth_metrics
  WHERE platform = p_platform 
    AND metric_type = p_metric_type
    AND recorded_at <= (p_calculation_date - INTERVAL '1 day')
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Get value from 7 days ago
  SELECT COALESCE(metric_value, 0) INTO val_7d
  FROM growth_metrics
  WHERE platform = p_platform 
    AND metric_type = p_metric_type
    AND recorded_at <= (p_calculation_date - INTERVAL '7 days')
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Get value from 30 days ago
  SELECT COALESCE(metric_value, 0) INTO val_30d
  FROM growth_metrics
  WHERE platform = p_platform 
    AND metric_type = p_metric_type
    AND recorded_at <= (p_calculation_date - INTERVAL '30 days')
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Get value from 1 year ago
  SELECT COALESCE(metric_value, 0) INTO val_1y
  FROM growth_metrics
  WHERE platform = p_platform 
    AND metric_type = p_metric_type
    AND recorded_at <= (p_calculation_date - INTERVAL '1 year')
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Insert or update analytics
  INSERT INTO growth_analytics (
    platform, metric_type, current_value, previous_value,
    change_1d, change_7d, change_30d, change_1y,
    change_1d_percent, change_7d_percent, change_30d_percent, change_1y_percent,
    calculated_at, calculated_date, data_period_start, data_period_end
  )
  VALUES (
    p_platform, p_metric_type, current_val, val_1d,
    (current_val - val_1d), (current_val - val_7d), (current_val - val_30d), (current_val - val_1y),
    CASE WHEN val_1d > 0 THEN ROUND(((current_val - val_1d)::DECIMAL / val_1d) * 100, 2) ELSE 0 END,
    CASE WHEN val_7d > 0 THEN ROUND(((current_val - val_7d)::DECIMAL / val_7d) * 100, 2) ELSE 0 END,
    CASE WHEN val_30d > 0 THEN ROUND(((current_val - val_30d)::DECIMAL / val_30d) * 100, 2) ELSE 0 END,
    CASE WHEN val_1y > 0 THEN ROUND(((current_val - val_1y)::DECIMAL / val_1y) * 100, 2) ELSE 0 END,
    p_calculation_date,
    p_calculation_date::date,
    (p_calculation_date - INTERVAL '1 year'),
    p_calculation_date
  )
  ON CONFLICT (platform, metric_type, calculated_date)
  DO UPDATE SET
    current_value = EXCLUDED.current_value,
    previous_value = EXCLUDED.previous_value,
    change_1d = EXCLUDED.change_1d,
    change_7d = EXCLUDED.change_7d,
    change_30d = EXCLUDED.change_30d,
    change_1y = EXCLUDED.change_1y,
    change_1d_percent = EXCLUDED.change_1d_percent,
    change_7d_percent = EXCLUDED.change_7d_percent,
    change_30d_percent = EXCLUDED.change_30d_percent,
    change_1y_percent = EXCLUDED.change_1y_percent,
    data_period_end = EXCLUDED.data_period_end,
    updated_at = NOW()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get current growth summary for all platforms
CREATE OR REPLACE FUNCTION get_growth_summary()
RETURNS TABLE (
  platform platform_type,
  metric_type metric_type,
  current_value BIGINT,
  change_1d BIGINT,
  change_7d BIGINT,
  change_30d BIGINT,
  change_1y BIGINT,
  change_1d_percent DECIMAL(10,2),
  change_7d_percent DECIMAL(10,2),
  change_30d_percent DECIMAL(10,2),
  change_1y_percent DECIMAL(10,2),
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ga.platform,
    ga.metric_type,
    ga.current_value,
    ga.change_1d,
    ga.change_7d,
    ga.change_30d,
    ga.change_1y,
    ga.change_1d_percent,
    ga.change_7d_percent,
    ga.change_30d_percent,
    ga.change_1y_percent,
    ga.calculated_at
  FROM growth_analytics ga
  WHERE ga.calculated_at = (
    SELECT MAX(calculated_at)
    FROM growth_analytics ga2
    WHERE ga2.platform = ga.platform AND ga2.metric_type = ga.metric_type
  )
  ORDER BY ga.platform, ga.metric_type;
END;
$$ LANGUAGE plpgsql;

-- Insert initial platform configurations
INSERT INTO growth_platform_configs (platform, collection_enabled, collection_interval_minutes, platform_metadata)
VALUES 
  ('discord', true, 60, '{"description": "Discord server metrics", "requires_bot_access": true}'::jsonb),
  ('telegram', true, 60, '{"description": "Telegram chat metrics", "requires_bot_access": true}'::jsonb),
  ('youtube', true, 120, '{"description": "YouTube channel metrics", "requires_api_key": true}'::jsonb),
  ('linkedin', true, 240, '{"description": "LinkedIn page metrics", "requires_api_key": true}'::jsonb),
  ('luma', true, 180, '{"description": "Luma page metrics", "requires_api_access": true}'::jsonb),
  ('email_newsletter', true, 360, '{"description": "Email newsletter signup metrics from Webflow", "requires_webflow_access": true}'::jsonb)
ON CONFLICT (platform) DO NOTHING; -- Don't overwrite existing configs

-- Create views for easy data access
CREATE OR REPLACE VIEW v_latest_growth_metrics AS
SELECT 
  gm.platform,
  gm.metric_type,
  gm.metric_value as current_value,
  gm.metric_metadata,
  gm.recorded_at as last_recorded,
  gpc.collection_enabled,
  gpc.last_collected_at,
  gpc.last_collection_status
FROM growth_metrics gm
JOIN growth_platform_configs gpc ON gm.platform = gpc.platform
WHERE gm.recorded_at = (
  SELECT MAX(recorded_at)
  FROM growth_metrics gm2
  WHERE gm2.platform = gm.platform AND gm2.metric_type = gm.metric_type
)
ORDER BY gm.platform, gm.metric_type;

-- Create view for marketing dashboard
CREATE OR REPLACE VIEW v_marketing_dashboard AS
SELECT 
  ga.platform,
  ga.metric_type,
  ga.current_value,
  ga.change_1d,
  ga.change_7d,
  ga.change_30d,
  ga.change_1y,
  ga.change_1d_percent,
  ga.change_7d_percent,
  ga.change_30d_percent,
  ga.change_1y_percent,
  ga.calculated_at,
  CASE 
    WHEN ga.change_1d > 0 THEN 'up'
    WHEN ga.change_1d < 0 THEN 'down'
    ELSE 'stable'
  END as trend_1d,
  CASE 
    WHEN ga.change_7d > 0 THEN 'up'
    WHEN ga.change_7d < 0 THEN 'down'
    ELSE 'stable'
  END as trend_7d,
  CASE 
    WHEN ga.change_30d > 0 THEN 'up'
    WHEN ga.change_30d < 0 THEN 'down'
    ELSE 'stable'
  END as trend_30d
FROM growth_analytics ga
WHERE ga.calculated_at = (
  SELECT MAX(calculated_at)
  FROM growth_analytics ga2
  WHERE ga2.platform = ga.platform AND ga2.metric_type = ga.metric_type
)
ORDER BY ga.platform, ga.metric_type;

-- Grant appropriate permissions (adjust based on your RLS policies)
-- These will need to be customized based on your existing RLS setup

COMMENT ON TABLE growth_metrics IS 'Stores raw growth metrics data from all platforms';
COMMENT ON TABLE growth_analytics IS 'Stores calculated growth changes and percentages for marketing dashboard';
COMMENT ON TABLE growth_platform_configs IS 'Configuration settings for each platform data collection';
COMMENT ON VIEW v_latest_growth_metrics IS 'Latest metric values for each platform';
COMMENT ON VIEW v_marketing_dashboard IS 'Ready-to-use data for marketing growth charts';