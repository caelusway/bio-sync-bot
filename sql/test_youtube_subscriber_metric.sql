-- Test script to run AFTER the enum has been added and committed
-- This should be run in a separate transaction after add_youtube_subscriber_metric.sql

-- Test if the new metric type works by inserting a sample record
INSERT INTO growth_metrics (
  platform,
  metric_type,
  metric_value,
  metric_metadata,
  recorded_at
) VALUES (
  'youtube',
  'youtube_subscriber_count',
  1180,
  '{"source": "youtube_api", "note": "YouTube subscriber count test"}',
  NOW()
) ON CONFLICT (platform, metric_type, recorded_at) DO UPDATE SET
  metric_value = EXCLUDED.metric_value,
  metric_metadata = EXCLUDED.metric_metadata,
  updated_at = NOW();

-- Update any existing records that were using impressions for subscriber count
UPDATE growth_metrics 
SET metric_metadata = jsonb_set(
  metric_metadata::jsonb, 
  '{note}', 
  '"Legacy: was used for subscriber count, now properly using youtube_subscriber_count"'
)
WHERE platform = 'youtube' 
  AND metric_type = 'youtube_total_impressions'
  AND metric_metadata::jsonb ->> 'note' LIKE '%subscriber count%';

-- Verify the new metric type works
SELECT platform, metric_type, metric_value, recorded_at 
FROM growth_metrics 
WHERE platform = 'youtube' 
ORDER BY recorded_at DESC 
LIMIT 5;