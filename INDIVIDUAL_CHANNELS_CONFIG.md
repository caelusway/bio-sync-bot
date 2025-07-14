# Individual Channels Configuration

## Environment Variable Setup

Add this environment variable to your `.env` file:

```bash
# Individual Channel Configuration (JSON format)
INDIVIDUAL_CHANNELS={"1199662748225777665":{"name":"marketing_general","message_category":"marketing","tge_phase":"pre-tge"},"1390367512016851036":{"name":"marketing_topics","message_category":"marketing","tge_phase":"pre-tge"},"1314862563426697299":{"name":"dao-program_general","message_category":"dao-program","tge_phase":"pre-tge"},"1390370321173057696":{"name":"dao-program_topics","message_category":"dao-program","tge_phase":"pre-tge"},"1392199344676929589":{"name":"biodao_topics","message_category":"core-general","tge_phase":"pre-tge"},"1387837570129330317":{"name":"ops_events","message_category":"events","tge_phase":"pre-tge"}}
```

## Formatted Configuration (for readability)

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
  },
  "1390370321173057696": {
    "name": "dao-program_topics",
    "message_category": "dao-program",
    "tge_phase": "pre-tge"
  },
  "1392199344676929589": {
    "name": "biodao_topics",
    "message_category": "core-general",
    "tge_phase": "pre-tge"
  },
  "1387837570129330317": {
    "name": "ops_events",
    "message_category": "events",
    "tge_phase": "pre-tge"
  }
}
```

## Channel Details

| Channel ID | Channel Name | Message Category | TGE Phase |
|------------|-------------|------------------|-----------|
| 1199662748225777665 | marketing_general | marketing | pre-tge |
| 1390367512016851036 | marketing_topics | marketing | pre-tge |
| 1314862563426697299 | dao-program_general | dao-program | pre-tge |
| 1390370321173057696 | dao-program_topics | dao-program | pre-tge |
| 1392199344676929589 | biodao_topics | core-general | pre-tge |
| 1387837570129330317 | ops_events | events | pre-tge |

## How It Works

1. **Individual Channel Support**: The bot now supports monitoring individual channels alongside category-based monitoring
2. **Channel Type Support**: Supports both regular text channels and forum channels (forum posts are treated as threads)
3. **Priority**: Individual channels take priority over category-based discovery (if a channel is configured both ways, the individual config wins)
4. **Auto-Discovery**: The bot will automatically discover the actual channel names from Discord and update the configuration
5. **Thread Support**: All individual channels support thread monitoring just like category-based channels
6. **Forum Support**: Forum channels are supported - forum posts are treated as threads for message monitoring

## Configuration Options

Each channel can be configured with the following options:

- `name`: Channel name (will be auto-updated from Discord)
- `message_category`: One of: `core-general`, `product`, `tech`, `ai-agents`, `ai`, `design`, `marketing`, `tokenomics`, `dao-program`, `events`, `other`
- `tge_phase`: Either `pre-tge` or `post-tge`
- `monitoring_enabled`: `true` or `false` (default: `true`)
- `filters`: Array of message filters (optional)

## Usage

1. Add the `INDIVIDUAL_CHANNELS` environment variable to your `.env` file
2. **Optional**: Enable historical message backfill by adding:
   ```env
   BACKFILL_HISTORICAL_MESSAGES=true
   BACKFILL_MESSAGE_LIMIT=100
   BACKFILL_DAYS_LIMIT=30
   ```
3. Restart your bot
4. The bot will automatically discover and configure these channels
5. If backfill is enabled, historical messages will be fetched from these channels
6. Check the logs for confirmation that the channels are being monitored

## Log Output

You should see output like:
```
📢 Monitoring individual channel: marketing_general (1199662748225777665) - marketing - pre-tge
📢 Monitoring individual channel: marketing_topics (1390367512016851036) - marketing - pre-tge
📢 Monitoring individual channel: dao-program_general (1314862563426697299) - dao-program - pre-tge
📢 Monitoring individual channel: dao-program_topics (1390370321173057696) - dao-program - pre-tge
📢 Monitoring individual channel: biodao_topics (1392199344676929589) - core-general - pre-tge
📢 Monitoring individual channel: ops_events (1387837570129330317) - events - pre-tge
``` 