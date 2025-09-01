-- Add member_count column to telegram_chat_stats table
ALTER TABLE telegram_chat_stats 
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- Update Bio Protocol community with current member count
UPDATE telegram_chat_stats 
SET member_count = 15592,
    total_messages = 29000,
    updated_at = NOW()
WHERE chat_id = '-1002245955682';

-- If record doesn't exist, insert it
INSERT INTO telegram_chat_stats (
  chat_id, 
  chat_title, 
  chat_type, 
  category, 
  total_messages, 
  messages_today, 
  messages_this_week, 
  member_count,
  active_users_count,
  updated_at
) 
SELECT 
  '-1002245955682',
  'Bio Protocol',
  'supergroup',
  'group',
  29000,
  0,
  0,
  15592,
  0,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM telegram_chat_stats WHERE chat_id = '-1002245955682'
);