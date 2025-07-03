# Category-Based Discord Monitoring Setup Guide

This guide explains how to configure the BioDAO Discord Bot to monitor entire Discord categories instead of individual channels.

## Why Category-Based Monitoring?

- ✅ **Automatic**: New channels are detected automatically
- ✅ **Scalable**: No need to update configuration when channels change
- ✅ **Organized**: Follows Discord's natural channel structure
- ✅ **Flexible**: Support for include/exclude patterns

## Step 1: Enable Discord Developer Mode

1. Open Discord
2. Go to **User Settings** (gear icon)
3. Navigate to **Advanced** → **Developer Mode**
4. Toggle **Developer Mode** ON

## Step 2: Identify Your Categories

In your Discord server, you'll see categories that group related channels:

```
📁 CORE TEAM (Category)
├── 💬 general
├── 📢 announcements
└── 🔒 private-discussion

📁 TECH DEVELOPMENT (Category)
├── 💻 development
├── 📊 data-analysis
└── 🧪 testing

📁 DAO GOVERNANCE (Category)
├── 🗳️ proposals
├── 💰 tokenomics
└── 📋 voting
```

## Step 3: Get Category IDs

1. **Right-click** on a category name
2. Click **"Copy ID"**
3. Save the ID (it looks like: `123456789012345678`)

Repeat for each category you want to monitor.

## Step 4: Configure Environment Variables

### Basic Configuration

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Category Monitoring
PRE_TGE_CATEGORIES=123456789012345678,234567890123456789
POST_TGE_CATEGORIES=345678901234567890,456789012345678901
```

### Advanced Configuration (Optional)

For fine-grained control, use the `CATEGORY_CONFIGS` variable:

```env
CATEGORY_CONFIGS={"123456789012345678":{"message_category":"core-general","tge_phase":"pre-tge","include_patterns":["important","announcement"],"exclude_patterns":["test","temp"]},"234567890123456789":{"message_category":"tech","tge_phase":"post-tge","include_patterns":["dev","engineering"]}}
```

## Step 5: Understanding Configuration Options

### TGE Phases
- `PRE_TGE_CATEGORIES`: Categories for pre-TGE internal discussions
- `POST_TGE_CATEGORIES`: Categories for post-TGE internal discussions
- `MONITORED_CATEGORIES`: Other categories (defaults to pre-TGE)

### Message Categories
The bot automatically determines message categories based on category names:

| Category Name Contains | Message Category |
|------------------------|------------------|
| "core", "general"      | core-general     |
| "product"              | product          |
| "tech"                 | tech             |
| "ai-agent", "ai_agent" | ai-agents        |
| "ai"                   | ai               |
| "design"               | design           |
| "marketing"            | marketing        |
| "tokenomic"            | tokenomics       |
| "dao", "program"       | dao-program      |
| "event"                | events           |
| Other                  | other            |

### Include/Exclude Patterns

Fine-tune which channels within categories are monitored:

```json
{
  "123456789012345678": {
    "include_patterns": ["important", "announcement", "official"],
    "exclude_patterns": ["test", "temp", "archived", "sandbox"]
  }
}
```

- **Include patterns**: Only channels matching these patterns will be monitored
- **Exclude patterns**: Channels matching these patterns will be ignored
- **Pattern matching**: Supports both substring and regex patterns

## Step 6: Verify Configuration

1. **Start the bot** in development mode:
   ```bash
   npm run dev
   ```

2. **Check the logs** for discovered channels:
   ```
   📁 Monitoring category: CORE TEAM (123456789012345678) - core-general - pre-tge
   📢 Monitoring channel: general (987654321098765432) in category CORE TEAM - core-general - pre-tge
   📢 Monitoring channel: announcements (876543210987654321) in category CORE TEAM - core-general - pre-tge
   ```

3. **Use the API** to verify configuration:
   ```bash
   curl http://localhost:3000/api/config/categories
   curl http://localhost:3000/api/config/channels
   ```

## Step 7: Test Auto-Discovery

1. **Create a new channel** in one of your monitored categories
2. **Check the logs** - the bot should automatically detect it:
   ```
   📢 New channel detected and configured: new-channel (765432109876543210) in category CORE TEAM
   ```

3. **Refresh configurations** manually if needed:
   ```bash
   curl -X POST http://localhost:3000/api/refresh-channels
   ```

## Configuration Examples

### Example 1: Simple Setup
Monitor all channels in two categories:

```env
PRE_TGE_CATEGORIES=123456789012345678
POST_TGE_CATEGORIES=234567890123456789
```

### Example 2: Filtered Setup
Monitor categories but exclude test channels:

```env
PRE_TGE_CATEGORIES=123456789012345678,234567890123456789
CATEGORY_CONFIGS={"123456789012345678":{"exclude_patterns":["test","temp"]},"234567890123456789":{"exclude_patterns":["sandbox","draft"]}}
```

### Example 3: Advanced Setup
Complex configuration with multiple options:

```env
PRE_TGE_CATEGORIES=123456789012345678,234567890123456789
POST_TGE_CATEGORIES=345678901234567890
CATEGORY_CONFIGS={"123456789012345678":{"message_category":"core-general","include_patterns":["important","official"],"exclude_patterns":["test"]},"234567890123456789":{"message_category":"tech","include_patterns":["dev","engineering"]},"345678901234567890":{"message_category":"marketing","exclude_patterns":["draft","temp"]}}
```

## Troubleshooting

### No Channels Detected
- ✅ Verify category IDs are correct
- ✅ Check bot has permission to view the categories
- ✅ Ensure categories contain text channels (not just voice)

### Some Channels Missing
- ✅ Check include/exclude patterns
- ✅ Verify channels are text channels
- ✅ Ensure bot can read message history in those channels

### Bot Not Responding to Messages
- ✅ Check bot permissions (Read Messages, Read Message History)
- ✅ Verify bot is in the Discord server
- ✅ Check bot token is valid

### Configuration Not Updating
- ✅ Restart the bot after changing environment variables
- ✅ Use the refresh endpoint: `POST /api/refresh-channels`
- ✅ Check logs for configuration parsing errors

## API Endpoints for Management

- `GET /api/config/categories` - View category configurations
- `GET /api/config/channels` - View discovered channels
- `POST /api/refresh-channels` - Refresh channel discovery
- `GET /api/stats/categories` - View category statistics
- `GET /api/stats/channels` - View channel statistics

## Best Practices

1. **Start Simple**: Begin with basic category monitoring, add patterns later
2. **Test First**: Always test in development before production
3. **Monitor Logs**: Watch logs to ensure channels are detected correctly
4. **Regular Refresh**: Set up periodic refresh to catch new channels
5. **Use Patterns Wisely**: Include/exclude patterns are powerful but can be complex
6. **Document Your Setup**: Keep track of which categories serve what purpose

## Migration from Channel-Based Configuration

If you're migrating from individual channel IDs:

1. **Identify which categories your channels belong to**
2. **Group channels by their Discord categories**
3. **Update environment variables** to use category IDs
4. **Test the new configuration** in development
5. **Deploy and verify** all expected channels are monitored

The bot will automatically discover all channels in the specified categories, so you no longer need to maintain a list of individual channel IDs. 