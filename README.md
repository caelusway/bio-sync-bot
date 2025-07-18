# BioDAO Discord Bot

A production-ready Discord bot built with TypeScript that monitors Discord channels by **categories** and stores messages in Supabase for the BioDAO community.

## Features

- 🤖 **Discord Integration**: Monitors entire Discord categories automatically
- 📊 **Supabase Storage**: Stores messages, channel stats, and user activity
- 🏷️ **Category Classification**: Automatically categorizes messages based on Discord categories
- 📈 **Analytics**: Tracks channel statistics and user activity
- 🔍 **REST API**: HTTP endpoints for data access
- 🛡️ **Security**: Rate limiting, CORS, and security headers
- 📝 **Logging**: Comprehensive logging with Winston
- 🐳 **Docker Ready**: Production-ready containerization
- 🔧 **Health Checks**: Built-in health monitoring endpoints
- 🔄 **Auto-Discovery**: Automatically detects new channels in monitored categories

## Categories Supported

- Core General
- Product
- Tech
- AI Agents
- AI
- Design
- Marketing
- Tokenomics
- DAO Program
- Events

## TGE Phases

- PRE-TGE INTERNAL
- POST-TGE INTERNAL

## Monitoring Modes

This bot supports two monitoring modes:

### 1. Category-Based Monitoring (Primary)

Monitor **entire Discord categories** automatically:

- ✅ **Automatic Detection**: New channels added to monitored categories are automatically tracked
- ✅ **Scalable**: No need to update configuration when channels are added/removed
- ✅ **Organized**: Follows Discord's natural channel organization
- ✅ **Flexible**: Supports include/exclude patterns for fine-grained control

#### How It Works

1. **Configure Categories**: Specify Discord category IDs instead of individual channel IDs
2. **Auto-Discovery**: Bot scans categories and finds all text channels
3. **Pattern Matching**: Optional include/exclude patterns for channel names
4. **Real-Time Updates**: Automatically handles new/deleted channels

### 2. Individual Channel Monitoring

Monitor **specific channels** by ID:

- ✅ **Precise Control**: Monitor exactly the channels you want
- ✅ **Cross-Category**: Monitor channels from different categories
- ✅ **Priority**: Individual channels take priority over category-based discovery
- ✅ **Thread Support**: Full thread monitoring support
- ✅ **Forum Support**: Forum channels supported (forum posts treated as threads)

#### How It Works

1. **Configure Channels**: Specify individual Discord channel IDs in JSON format
2. **Auto-Discovery**: Bot fetches channel details from Discord
3. **Categorization**: Automatically categorizes channels based on names
4. **Thread Support**: Automatically joins and monitors threads

### Hybrid Approach

You can use both modes together:
- Individual channels take priority (if a channel is configured both ways, individual config wins)
- Category-based discovery fills in the rest
- No conflicts or duplicate monitoring

## Quick Start

### Prerequisites

- Node.js 18+
- Discord Bot Token
- Supabase Project
- Discord Category IDs (see setup guide below)

### Getting Category IDs

1. **Enable Developer Mode** in Discord:
   - User Settings → Advanced → Developer Mode ✅

2. **Get Category ID**:
   - Right-click on a category in your Discord server
   - Click "Copy ID"
   - Use this ID in your configuration

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd biodao-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Supabase database**
   ```bash
   # Run the SQL schema in your Supabase project
   # File: sql/schema.sql
   ```

5. **Configure categories**
   ```env
   # Discord category IDs (not channel IDs!)
   PRE_TGE_CATEGORIES=123456789012345678,234567890123456789
   POST_TGE_CATEGORIES=345678901234567890,456789012345678901
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Variables

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_discord_guild_id

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Category Configuration (use category IDs, not channel IDs)
PRE_TGE_CATEGORIES=category_id_1,category_id_2
POST_TGE_CATEGORIES=category_id_3,category_id_4
MONITORED_CATEGORIES=category_id_5,category_id_6

# Individual Channel Configuration (JSON format)
INDIVIDUAL_CHANNELS={"channel_id_1":{"name":"channel_name","message_category":"marketing","tge_phase":"pre-tge"},"channel_id_2":{"name":"channel_name_2","message_category":"dao-program","tge_phase":"pre-tge"}}

# Advanced Category Configuration (Optional JSON)
CATEGORY_CONFIGS={"category_id_1":{"message_category":"core-general","include_patterns":["important"],"exclude_patterns":["test"]}}

# Telegram Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_URL=your_webhook_url
TELEGRAM_POLLING=true

# Historical Message Backfill (Optional)
BACKFILL_HISTORICAL_MESSAGES=true
BACKFILL_MESSAGE_LIMIT=100
BACKFILL_DAYS_LIMIT=30

# Optional Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## Individual Channel Configuration

For monitoring specific channels, use the `INDIVIDUAL_CHANNELS` environment variable with JSON configuration:

```json
{
  "1199662748225777665": {
    "name": "marketing_general",
    "message_category": "marketing",
    "tge_phase": "pre-tge"
  },
  "1390367512016851036": {
    "name": "marketing_topics",
    "message_category": "marketing",
    "tge_phase": "pre-tge"
  },
  "1314862563426697299": {
    "name": "dao-program_general",
    "message_category": "dao-program",
    "tge_phase": "pre-tge"
  }
}
```

### Individual Channel Options

- **name**: Channel name (will be auto-updated from Discord)
- **message_category**: One of: `core-general`, `product`, `tech`, `ai-agents`, `ai`, `design`, `marketing`, `tokenomics`, `dao-program`, `events`, `other`
- **tge_phase**: Either `pre-tge` or `post-tge`
- **monitoring_enabled**: `true` or `false` (default: `true`)
- **filters**: Array of message filters (optional)

### Supported Channel Types

- **Text Channels** (Type 0): Regular Discord text channels with thread support
- **Forum Channels** (Type 15): Discord forum channels where posts are treated as threads

## Historical Message Backfill

The bot supports backfilling historical messages from tracked channels on startup or on-demand. This ensures you capture existing conversations when first deploying the bot.

### Environment Variables

```env
# Enable backfill on bot startup
BACKFILL_HISTORICAL_MESSAGES=true

# Maximum messages to fetch per channel (default: 100)
BACKFILL_MESSAGE_LIMIT=500

# Only backfill messages from the last X days (default: 30)
BACKFILL_DAYS_LIMIT=7
```

### Features

- ✅ **Automatic Startup**: Backfill runs automatically when `BACKFILL_HISTORICAL_MESSAGES=true`
- ✅ **Manual Trigger**: Use API endpoint `POST /api/backfill/historical-messages`
- ✅ **Smart Deduplication**: Skips messages that already exist in the database
- ✅ **Thread Support**: Backfills messages from threads and forum posts
- ✅ **Rate Limited**: Respects Discord's rate limits during backfill
- ✅ **Configurable Limits**: Control how many messages and how far back to fetch
- ✅ **Progress Logging**: Detailed logging of backfill progress

### Usage

1. **First Time Setup**: Set `BACKFILL_HISTORICAL_MESSAGES=true` in your `.env` file
2. **Start the Bot**: Historical messages will be backfilled automatically on startup
3. **Manual Backfill**: Use the API endpoint for on-demand backfilling
4. **Monitor Progress**: Check logs for detailed backfill statistics

### API Endpoint

```bash
# Trigger manual backfill
curl -X POST http://localhost:3000/api/backfill/historical-messages
```

## Advanced Category Configuration

For fine-grained control, you can use the `CATEGORY_CONFIGS` environment variable with JSON configuration:

```json
{
  "123456789012345678": {
    "message_category": "core-general",
    "tge_phase": "pre-tge",
    "include_patterns": ["important", "announcements"],
    "exclude_patterns": ["test", "temp", "archived"],
    "monitoring_enabled": true
  },
  "234567890123456789": {
    "message_category": "tech",
    "tge_phase": "post-tge",
    "include_patterns": ["dev", "engineering"],
    "exclude_patterns": ["sandbox"]
  }
}
```

### Pattern Matching

- **Include Patterns**: Only channels matching these patterns will be monitored
- **Exclude Patterns**: Channels matching these patterns will be ignored
- **Pattern Types**: Supports both substring matching and regex patterns

## Discord Bot Setup

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the bot token

2. **Bot Permissions**
   
   **⚠️ Important**: This bot does **NOT** need Administrator permissions or any elevated access.
   
   **Option A: Direct Bot Permissions (Current)**
   **CRITICAL** - Required bot permissions:
   - **View Channels** (essential - to discover channels in categories)
   - **Read Message History** (essential - to read messages and backfill historical data)
   - **Send Messages** (optional, only if using bot's send functionality)
   
   **NOT NEEDED** - Remove these permissions:
   - ❌ **Presence** (bot doesn't track user status)
   - ❌ **Members** (not needed - author info comes from messages)

   **Option B: Role-Based Permissions (Recommended)**
   1. Create a "Bio Core" role with these permissions:
      - **View Channels** (essential)
      - **Read Message History** (essential)
      - **Send Messages** (optional)
   2. Assign this role to the bot
   3. Configure channel-specific permissions for monitored categories
   4. **DO NOT** give: Presence, Members, or any admin permissions

3. **Invite Bot to Server**
   ```
   # Recommended permissions (68608 = View Channels + Read Message History + Send Messages)
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=68608&scope=bot
   
   # Read-only minimal (67584 = View Channels + Read Message History only)
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=67584&scope=bot
   ```

   **⚠️ IMPORTANT**: Your current bot permissions are missing **View Channels** which is essential for operation!

### Fix Current Permission Issues

If your bot currently has **Read Messages**, **Presence**, and **Members** permissions:

1. **Remove unnecessary permissions**:
   - ❌ Remove **Presence** (not needed)
   - ❌ Remove **Members** (not needed)

2. **Add missing essential permission**:
   - ✅ Add **View Channels** (critical for operation)

3. **Keep essential permissions**:
   - ✅ Keep **Read Message History** (essential)
   - ✅ Optionally add **Send Messages** (if needed)

**Result**: Your bot should have only **View Channels** + **Read Message History** + **Send Messages** (optional)

### Transitioning to Bio Core Role-Based Permissions

If you want to use a "Bio Core" role instead of direct bot permissions:

1. **Create the Bio Core Role**:
   - Server Settings → Roles → Create Role
   - Name: "Bio Core"
   - **Server Permissions**: 
     - ✅ **View Channels** (essential)
     - ✅ **Read Message History** (essential)
     - ✅ **Send Messages** (optional)
   - **DO NOT** give: Administrator, Manage Server, Manage Channels, Presence, Members

2. **Configure Channel Access**:
   - For each monitored category, ensure Bio Core role has:
     - ✅ **View Channel** (essential)
     - ✅ **Read Message History** (essential)
     - ✅ **Send Messages** (optional, if needed)
   - **DO NOT** enable: Presence, Members, or management permissions

3. **Assign Role to Bot**:
   - Server Settings → Members
   - Find your bot → Edit → Assign "Bio Core" role
   - Remove any other roles (especially admin roles)

4. **Test the Setup**:
   - Check that the bot can still see monitored channels
   - Verify it can read message history for backfill
   - Confirm monitoring works as expected

### Security Benefits of Role-Based Approach

- ✅ **Easier Management**: Update permissions in one place
- ✅ **Principle of Least Privilege**: Only necessary permissions
- ✅ **Auditable**: Clear role-based access control
- ✅ **Scalable**: Easy to apply to multiple bots/services
- ✅ **Revocable**: Easy to modify or remove access

## API Endpoints

### Health Checks
- `GET /health` - Overall health status
- `GET /health/readiness` - Readiness check
- `GET /health/liveness` - Liveness check

### Data Access
- `GET /api/messages/:channelId` - Get messages by channel
- `GET /api/messages/category/:category` - Get messages by category
- `GET /api/stats/channels` - Get channel statistics

### Management
- `POST /api/refresh-channels` - Refresh channel configurations (discovers new channels)

## Database Schema

The bot uses the following main tables:

- **discord_messages**: Stores all Discord messages with category metadata
- **channel_stats**: Channel-level statistics
- **user_activity**: User activity tracking

Key features:
- Full message content and metadata
- Category and TGE phase tracking
- Automatic cleanup of old messages
- Performance indexes for fast queries

See `sql/schema.sql` for complete schema.

## Development

### Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run test         # Run tests
npm run clean        # Clean build directory
```

### Project Structure

```
src/
├── config/          # Configuration files (category-based)
├── handlers/        # Express route handlers
├── services/        # Business logic services
│   ├── discord.ts   # Category discovery & monitoring
│   └── database.ts  # Supabase integration
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

## Production Deployment

### Docker Deployment

1. **Build and run with Docker**
   ```bash
   docker build -t biodao-discord-bot .
   docker run -d --name biodao-bot --env-file .env -p 3000:3000 biodao-discord-bot
   ```

2. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start with PM2**
   ```bash
   npm install -g pm2
   pm2 start deploy/pm2.config.js
   pm2 save
   pm2 startup
   ```

### Environment-specific Configuration

#### Production
- Set `NODE_ENV=production`
- Use service role key for Supabase
- Configure proper logging levels
- Set up monitoring and alerting

#### Development
- Set `NODE_ENV=development`
- Use development Discord server
- Enable debug logging

## Monitoring

The bot includes several monitoring features:

1. **Health Endpoints**: `/health`, `/health/readiness`, `/health/liveness`
2. **Logging**: Structured logs with Winston
3. **Error Handling**: Comprehensive error catching
4. **Database Cleanup**: Automatic cleanup of old messages
5. **Channel Discovery**: Real-time detection of new/deleted channels

## Security Features

- **Rate Limiting**: Prevents API abuse
- **CORS**: Configurable cross-origin requests
- **Helmet**: Security headers
- **Input Validation**: Validates all inputs
- **RLS**: Row Level Security in Supabase

## Migration from Channel-Based to Category-Based

If you have an existing channel-based configuration:

1. **Identify Categories**: Group your channels by their Discord categories
2. **Get Category IDs**: Use Discord Developer Mode to copy category IDs
3. **Update Environment**: Replace `MONITORED_CHANNELS` with `PRE_TGE_CATEGORIES` etc.
4. **Test Configuration**: Run in development mode to verify channel discovery
5. **Deploy**: The bot will automatically discover all channels in the categories

## Troubleshooting

### Common Issues

1. **No channels detected**
   - Verify category IDs are correct
   - Check bot has access to the categories
   - Review logs for permission errors

2. **Some channels not monitored**
   - Check include/exclude patterns
   - Verify channels are text channels (not voice)
   - Ensure channels are in the specified categories

3. **Bot not responding**
   - Check bot permissions
   - Verify Discord token is valid
   - Review health endpoints

4. **Permission-related issues**
   - **"Missing Access" errors**: Bot lacks View Channels permission
   - **"Cannot read message history"**: Bot lacks Read Message History permission
   - **Channel discovery fails**: Verify Bio Core role has access to monitored categories
   - **Backfill fails**: Ensure Read Message History permission is granted for all monitored channels
   - **Bot has wrong permissions**: Remove Presence/Members, ensure View Channels is enabled

### Verifying Bot Permissions

To verify your bot has the correct permissions:

1. **Check Role Assignment**:
   ```bash
   # Look for "Bio Core" role in server member list
   # Bot should have ONLY the Bio Core role (no admin roles)
   ```

2. **Test Channel Access**:
   - Go to any monitored channel
   - Check if bot appears in member list
   - Verify bot can see message history

3. **Monitor Bot Logs**:
   ```bash
   # Look for permission errors in logs
   docker logs biodao-bot | grep -i "permission\|access\|forbidden"
   ```

4. **Use Discord Developer Tools**:
   - Enable Developer Mode in Discord
   - Right-click bot → "Copy ID"
   - Check bot permissions in Server Settings → Members

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and formatting
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review logs for error details

## Changelog

### v2.0.0 - Category-Based Monitoring
- **BREAKING**: Changed from individual channel IDs to category-based monitoring
- Added automatic channel discovery
- Added pattern matching for include/exclude channels
- Added real-time channel creation/deletion handling
- Improved scalability and maintainability

### v1.0.0 - Initial Release
- Discord message monitoring
- Supabase integration
- REST API endpoints
- Docker support
- Production-ready deployment 