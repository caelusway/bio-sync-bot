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

## Category-Based Monitoring

Instead of configuring individual channel IDs, this bot monitors **entire Discord categories**. This approach offers several advantages:

- ✅ **Automatic Detection**: New channels added to monitored categories are automatically tracked
- ✅ **Scalable**: No need to update configuration when channels are added/removed
- ✅ **Organized**: Follows Discord's natural channel organization
- ✅ **Flexible**: Supports include/exclude patterns for fine-grained control

### How It Works

1. **Configure Categories**: Specify Discord category IDs instead of individual channel IDs
2. **Auto-Discovery**: Bot scans categories and finds all text channels
3. **Pattern Matching**: Optional include/exclude patterns for channel names
4. **Real-Time Updates**: Automatically handles new/deleted channels

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

# Advanced Category Configuration (Optional JSON)
CATEGORY_CONFIGS={"category_id_1":{"message_category":"core-general","include_patterns":["important"],"exclude_patterns":["test"]}}

# Optional Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
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
   Required bot permissions:
   - View Channels
   - Read Message History
   - Send Messages

3. **Invite Bot to Server**
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=68608&scope=bot
   ```

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