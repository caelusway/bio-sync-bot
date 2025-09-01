-- Add YouTube subscriber count metric type support
-- The database uses an enum constraint for metric_type, so we need to add the new value
-- NOTE: This must be run in separate transactions due to PostgreSQL enum safety requirements

-- Step 1: Add the new enum value (must be committed before use)
ALTER TYPE metric_type ADD VALUE IF NOT EXISTS 'youtube_subscriber_count';

-- Step 2: Commit the transaction before using the new enum value
-- In a separate transaction/connection, you can then test:

-- Clean up the misused impressions records (they were storing subscriber count incorrectly)
-- Mark them as deprecated so we know they contain wrong data
UPDATE growth_metrics 
SET metric_metadata = jsonb_set(
  jsonb_set(
    metric_metadata::jsonb, 
    '{deprecated}', 
    'true'
  ),
  '{original_note}', 
  to_jsonb(metric_metadata::jsonb ->> 'note')
) || '{"note": "DEPRECATED: This record incorrectly stored subscriber count as impressions. Real impressions require YouTube Analytics API."}'
WHERE platform = 'youtube' 
  AND metric_type = 'youtube_total_impressions'
  AND (
    metric_metadata::jsonb ->> 'note' LIKE '%subscriber count%' 
    OR metric_metadata::jsonb ->> 'note' LIKE '%Using subscriber count as proxy%'
    OR metric_metadata::jsonb ->> 'actual_metric_type' = 'youtube_subscriber_count'
  );