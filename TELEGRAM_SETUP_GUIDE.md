# Telegram Bot Setup Guide

This guide explains how to set up the Telegram bot functionality alongside the existing Discord bot.

## Prerequisites

1. A Telegram bot token from BotFather
2. Access to the groups/channels you want to monitor

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Telegram Bot Configuration (optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/telegram/webhook  # Optional
TELEGRAM_POLLING=true  # Default: true, set to false for webhook mode
```

## Getting a Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather
3. Send `/newbot` command
4. Follow the instructions to create your bot
5. Copy the bot token provided by BotFather

## How the Telegram Bot Works

The Telegram bot operates differently from the Discord bot:

### Key Differences from Discord:
- **No category system**: Telegram bot monitors all groups/channels it's added to
- **Group-based monitoring**: Each group/channel is treated as a separate monitoring unit
- **Automatic discovery**: Bot automatically discovers and monitors new groups when added
- **Simple categorization**: Groups are categorized as 'group', 'channel', or 'private'

### Features:
- **Message Storage**: All messages are stored in the `telegram_messages` table
- **Chat Statistics**: Tracks message counts per chat in `telegram_chat_stats`
- **User Activity**: Monitors user activity per chat in `telegram_user_activity`
- **Rate Limiting**: Respects Telegram's rate limits (30 requests/second)
- **Attachment Support**: Handles photos, videos, documents, audio, stickers, etc.
- **Message Updates**: Tracks message edits
- **Reply/Forward Support**: Captures reply and forward relationships

## Database Schema

The Telegram bot uses separate tables from Discord:

- `telegram_messages`: Stores all Telegram messages
- `telegram_chat_stats`: Chat-level statistics
- `telegram_user_activity`: User activity per chat

## Adding the Bot to Groups

1. Add your bot to the desired Telegram groups/channels
2. Make sure the bot has permission to read messages
3. The bot will automatically start monitoring and storing messages

## Monitoring

The bot provides logs for:
- Chat discovery
- Message processing
- Rate limiting
- Error handling

Example logs:
```
📱 Telegram bot logged in as @your_bot_name
📱 New chat discovered: My Group (-1001234567890) - supergroup
📱 Telegram message saved: 123 in My Group
```

## Configuration

Unlike Discord, Telegram monitoring is automatically enabled for all groups the bot is added to. There's no need to configure specific categories or channels.

## Deployment Considerations

### Polling vs Webhook Mode

**Polling Mode (Default):**
- Easier to set up
- Works behind NAT/firewall
- Suitable for development and small deployments

**Webhook Mode:**
- More efficient for high-volume bots
- Requires public HTTPS endpoint
- Better for production deployments

To use webhook mode:
1. Set `TELEGRAM_POLLING=false`
2. Set `TELEGRAM_WEBHOOK_URL` to your public webhook endpoint
3. Ensure your server has a valid SSL certificate

## Rate Limiting

The bot automatically handles Telegram's rate limits:
- 30 requests per second
- Exponential backoff on rate limit errors
- Automatic retry on network errors

## Troubleshooting

### Common Issues:

1. **Bot not receiving messages**: Make sure bot has permission to read messages in the group
2. **Rate limiting errors**: The bot automatically handles these, but high message volumes might cause delays
3. **Database errors**: Check Supabase connection and table permissions

### Logs to Monitor:

- `Failed to save Telegram message`: Database connection issues
- `Telegram rate limited`: Normal, handled automatically
- `Telegram bot error`: Check bot token and permissions

## Security Considerations

- Keep your bot token secure
- Use environment variables for sensitive configuration
- Consider using webhook mode with proper SSL for production
- Monitor bot access to sensitive groups

## Testing

To test the Telegram bot:

1. Start the application with `TELEGRAM_BOT_TOKEN` set
2. Add the bot to a test group
3. Send messages to the group
4. Check the logs for message processing confirmation
5. Verify data in the `telegram_messages` table 