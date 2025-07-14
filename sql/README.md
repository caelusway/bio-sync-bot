# BioSync Database Setup

This directory contains SQL scripts for setting up the BioSync database with proper Row Level Security (RLS) policies for Supabase.

## Files

### 1. `complete_schema_with_policies.sql`
**Use this for:** Fresh database setup or complete recreation

This comprehensive script includes:
- ✅ All table creation statements
- ✅ RLS policies for all tables
- ✅ Performance indexes
- ✅ Utility views and functions
- ✅ 33 DAO tweet tables
- ✅ Discord and Telegram tables
- ✅ Core system tables

### 2. `rls_policies_only.sql`
**Use this for:** Existing databases that need RLS policies

This focused script includes:
- ✅ Enable RLS on all existing tables
- ✅ Create insert/update/select policies
- ✅ No table creation (assumes tables exist)

### 3. `schema.sql` (Original)
Your original schema file for reference.

## How to Use

### Option 1: Fresh Database Setup
```sql
-- Run this in your Supabase SQL editor
\i complete_schema_with_policies.sql
```

### Option 2: Add Policies to Existing Tables
```sql
-- Run this in your Supabase SQL editor
\i rls_policies_only.sql
```

## What the Policies Do

### Insert Policies
- Allow your service to insert data into all tables
- No authentication required (suitable for data collection)

### Update Policies
- Allow your service to update existing records
- Useful for stats tables and message updates

### Select Policies
- Allow public read access to all tables
- Enables analytics and reporting

## Tables Covered

### Core Tables
- `daos` - DAO information
- `dao_sync_logs` - Sync logging
- `dao_sync_stats` - Sync statistics

### Discord Tables
- `discord_messages` - All Discord messages
- `discord_channel_stats` - Channel statistics
- `discord_user_activity` - User activity tracking

### Telegram Tables
- `telegram_messages` - All Telegram messages
- `telegram_chat_stats` - Chat statistics
- `telegram_user_activity` - User activity tracking

### DAO Tweet Tables (33 total)
- `dao_athenadao_tweets`
- `dao_beeardai_tweets`
- `dao_bioprotocol_tweets`
- ... and 30 more DAO tweet tables

## Security Notes

### Current Policy Settings
- **INSERT**: Open (allows all inserts)
- **UPDATE**: Open (allows all updates)
- **SELECT**: Open (allows all reads)

### For Production
Consider restricting policies to specific service roles:

```sql
-- Example: Restrict to service role
CREATE POLICY "Allow service inserts" ON public.discord_messages
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

## Performance Features

### Indexes Created
- Channel/chat ID indexes for fast filtering
- User ID indexes for user-specific queries
- Timestamp indexes for time-based queries
- Category indexes for grouping

### Utility Views
- `all_dao_tweets` - Combined view of all DAO tweets
- `recent_activity` - Recent activity across all platforms

### Utility Functions
- `get_dao_tweet_count(dao_name)` - Get tweet count for a DAO
- `get_all_dao_names()` - Get list of all DAO names

## Troubleshooting

### If you get permission errors:
1. Make sure you're running as a superuser in Supabase
2. Check if RLS is properly enabled
3. Verify the policies were created correctly

### If tables already exist:
- Use `rls_policies_only.sql` instead of the complete script
- The complete script uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times

### To verify policies are working:
```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Environment Setup

Make sure your service has the appropriate Supabase credentials:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (for read operations)
- `SUPABASE_SERVICE_KEY` (for write operations)

## Data Collection Flow

With these policies in place, your service can:
1. Insert Discord messages in real-time
2. Update channel statistics
3. Insert Telegram messages
4. Update user activity tracking
5. Insert DAO tweets from Twitter
6. Log sync operations
7. Track sync statistics

The policies ensure data can flow seamlessly while maintaining security boundaries appropriate for a data collection system. 