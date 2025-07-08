# Telegram Migration Guide

This guide will help you safely add Telegram functionality to your existing Supabase database without affecting your current Discord data.

## 🚀 Quick Start

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to [supabase.com](https://supabase.com/dashboard)
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the entire content from `sql/telegram_migration.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration

### Option 2: Using Supabase CLI

```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link to your project (replace with your project ref)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push --file sql/telegram_migration.sql
```

### Option 3: Using Database URL (Direct Connection)

```bash
# If you have psql installed
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f sql/telegram_migration.sql
```

## 📋 What This Migration Does

### ✅ **Adds New Tables:**
- `telegram_messages` - Stores all Telegram messages
- `telegram_chat_stats` - Tracks chat statistics
- `telegram_user_activity` - Tracks user activity per chat

### ✅ **Adds New Enum:**
- `telegram_message_category` - Categorizes messages (group, channel, private)

### ✅ **Adds New Indexes:**
- Performance indexes for all Telegram tables

### ✅ **Adds New Function:**
- `upsert_telegram_user_activity()` - Handles user activity updates

### ✅ **Adds New Triggers:**
- Auto-updates `updated_at` timestamps for Telegram tables

## 🔒 Safety Guarantees

### ✅ **What WON'T be affected:**
- ✅ All existing Discord tables remain unchanged
- ✅ All existing Discord data remains intact
- ✅ All existing Discord functionality continues to work
- ✅ No downtime for your Discord bot

### ✅ **What WILL be added:**
- ✅ New Telegram tables (empty initially)
- ✅ New Telegram-specific functions
- ✅ New indexes for performance

## 📊 Verification Steps

After running the migration, verify it worked correctly:

### 1. Check if tables were created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'telegram_%'
ORDER BY table_name;
```

**Expected output:**
```
telegram_chat_stats
telegram_messages
telegram_user_activity
```

### 2. Check if enum was created:
```sql
SELECT enumname 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'telegram_message_category';
```

**Expected output:**
```
group
channel
private
```

### 3. Check if function was created:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'upsert_telegram_user_activity';
```

**Expected output:**
```
upsert_telegram_user_activity
```

### 4. Verify table structure:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'telegram_messages' 
ORDER BY ordinal_position;
```

## 🔄 Rollback (If Needed)

If you need to rollback the migration, run this SQL:

```sql
-- WARNING: This will delete all Telegram data!
DROP TABLE IF EXISTS telegram_messages CASCADE;
DROP TABLE IF EXISTS telegram_chat_stats CASCADE;
DROP TABLE IF EXISTS telegram_user_activity CASCADE;
DROP FUNCTION IF EXISTS upsert_telegram_user_activity CASCADE;
DROP TYPE IF EXISTS telegram_message_category CASCADE;
```

## 🎯 Next Steps

After successful migration:

1. **Update your environment variables:**
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

2. **Test the bot:**
   ```bash
   npm run dev
   ```

3. **Monitor logs:**
   - Check that both Discord and Telegram bots start successfully
   - Verify messages are being stored in the new tables

4. **Optional: Set up monitoring:**
   ```sql
   -- Check message counts
   SELECT 
     'Discord' as platform, 
     COUNT(*) as message_count 
   FROM discord_messages
   UNION ALL
   SELECT 
     'Telegram' as platform, 
     COUNT(*) as message_count 
   FROM telegram_messages;
   ```

## 🆘 Troubleshooting

### Common Issues:

1. **"relation already exists" error:**
   - This means the table already exists
   - Check what tables you already have
   - You might need to modify the migration

2. **"permission denied" error:**
   - Make sure you have the correct database permissions
   - Try using the Supabase Dashboard instead

3. **"function update_updated_at_column() does not exist":**
   - This function should already exist from your Discord setup
   - If not, you might need to run the full schema first

### Getting Help:

If you encounter any issues:
1. Check the Supabase Dashboard logs
2. Verify your database connection
3. Make sure you have the correct project permissions
4. Check the Discord bot is still working after migration

## 📝 Migration File Details

The migration file (`sql/telegram_migration.sql`) contains:
- **50 lines** of table definitions
- **20 lines** of indexes
- **15 lines** of triggers
- **30 lines** of function definitions
- **Total: ~115 lines** of safe, additive SQL

**Migration time: ~2-5 seconds** depending on your database size.

## ✅ Success Checklist

- [ ] Migration executed without errors
- [ ] All 3 Telegram tables created
- [ ] Telegram enum created
- [ ] Indexes created successfully
- [ ] Function created successfully
- [ ] Triggers created successfully
- [ ] Discord functionality still works
- [ ] Bot starts successfully with both Discord and Telegram 