# 🧪 Growth Tracking Testing Guide

## 🚀 Quick Test Setup (5 Minutes)

### Step 1: Database Setup
```sql
-- Run these in Supabase SQL Editor:
\i sql/growth_tracking_schema.sql
\i sql/growth_initial_data.sql
```

### Step 2: Enable Growth Tracking
Your .env file now has `GROWTH_TRACKING_ENABLED="true"` - this will activate the system.

### Step 3: Start the Bot
```bash
npm run dev
# or
npm start
```

## 📊 Testing Methods

### 1. **API Endpoint Testing**

#### Check System Status
```bash
curl http://localhost:3000/api/growth/status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "service_running": true,
    "active_collections": ["discord", "telegram", "youtube", "linkedin", "luma", "email_newsletter"],
    "collection_count": 6,
    "available_platforms": ["discord", "telegram", "youtube", "linkedin", "luma", "email_newsletter"],
    "available_metrics": ["discord_message_count", "discord_member_count", ...],
    "status": "active"
  }
}
```

#### View Dashboard Data
```bash
curl http://localhost:3000/api/growth/dashboard
```

**Expected Response (Fresh Start):**
```json
{
  "success": true,
  "data": [
    {
      "platform": "discord",
      "metric_type": "discord_message_count",
      "current_value": 0,
      "change_1d": 0,
      "change_7d": 0,
      "change_30d": 0,
      "change_1y": 0,
      "change_1d_percent": 0,
      "change_7d_percent": 0,
      "change_30d_percent": 0,
      "change_1y_percent": 0,
      "trend_1d": "stable",
      "trend_7d": "stable",
      "trend_30d": "stable"
    }
    // ... more platforms
  ]
}
```

#### Get Latest Metrics Overview
```bash
curl http://localhost:3000/api/growth/metrics/latest
```

#### Get Platform-Specific Data
```bash
curl http://localhost:3000/api/growth/platform/discord
curl http://localhost:3000/api/growth/platform/youtube
```

### 2. **Manual Data Collection Testing**

#### Trigger Collection for All Platforms
```bash
curl -X POST http://localhost:3000/api/growth/collect
```

#### Trigger Collection for Specific Platform
```bash
curl -X POST http://localhost:3000/api/growth/collect/discord
curl -X POST http://localhost:3000/api/growth/collect/youtube
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Data collection completed: 6/6 platforms successful",
  "results": [
    {
      "platform": "discord",
      "metrics_collected": [
        {
          "metric_type": "discord_message_count",
          "value": 0,
          "metadata": {
            "status": "api_not_implemented",
            "note": "Requires Discord API integration for fresh server stats"
          }
        }
      ],
      "collection_timestamp": "2024-01-15T10:30:00Z",
      "success": true
    }
  ]
}
```

### 3. **Database Verification**

#### Check Tables Were Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'growth_%'
ORDER BY table_name;
```

**Expected Results:**
- `growth_analytics`
- `growth_metrics`
- `growth_platform_configs`

#### View Initial Data
```sql
-- Check platform configurations
SELECT platform, collection_enabled, collection_interval_minutes, last_collection_status 
FROM growth_platform_configs 
ORDER BY platform;

-- Check initial metrics (should all be 0)
SELECT platform, metric_type, metric_value, recorded_at 
FROM growth_metrics 
ORDER BY platform, metric_type;

-- Check analytics (should all be 0 changes)
SELECT platform, metric_type, current_value, change_1d, change_7d, change_30d 
FROM growth_analytics 
ORDER BY platform, metric_type;
```

#### Use Built-in Views
```sql
-- Marketing dashboard view
SELECT * FROM v_marketing_dashboard ORDER BY platform, metric_type;

-- Latest metrics view
SELECT * FROM v_latest_growth_metrics ORDER BY platform, metric_type;
```

### 4. **Simulating Real Data for Testing**

#### Insert Test Data Manually
```sql
-- Simulate some growth data for testing
INSERT INTO growth_metrics (platform, metric_type, metric_value, recorded_at, metric_metadata)
VALUES 
  -- Discord growth over 3 days
  ('discord', 'discord_message_count', 100, NOW() - INTERVAL '2 days', '{"source": "test_data"}'::jsonb),
  ('discord', 'discord_message_count', 150, NOW() - INTERVAL '1 day', '{"source": "test_data"}'::jsonb),
  ('discord', 'discord_message_count', 200, NOW(), '{"source": "test_data"}'::jsonb),
  
  -- YouTube growth
  ('youtube', 'youtube_total_views', 1000, NOW() - INTERVAL '2 days', '{"source": "test_data"}'::jsonb),
  ('youtube', 'youtube_total_views', 1250, NOW() - INTERVAL '1 day', '{"source": "test_data"}'::jsonb),
  ('youtube', 'youtube_total_views', 1500, NOW(), '{"source": "test_data"}'::jsonb)
ON CONFLICT (platform, metric_type, recorded_at) DO NOTHING;

-- Recalculate analytics with test data
SELECT calculate_growth_analytics('discord'::platform_type, 'discord_message_count'::metric_type);
SELECT calculate_growth_analytics('youtube'::platform_type, 'youtube_total_views'::metric_type);
```

#### Test Dashboard with Real Data
```bash
curl http://localhost:3000/api/growth/dashboard
```

**Expected Response (With Test Data):**
```json
{
  "success": true,
  "data": [
    {
      "platform": "discord",
      "metric_type": "discord_message_count",
      "current_value": 200,
      "change_1d": 50,        // 200 - 150
      "change_2d": 100,       // 200 - 100
      "change_1d_percent": 33.33,  // (50/150) * 100
      "trend_1d": "up"
    }
  ]
}
```

### 5. **Performance & Error Testing**

#### Test Rate Limiting
```bash
# Send multiple requests quickly
for i in {1..10}; do curl -X POST http://localhost:3000/api/growth/collect & done
```

#### Test Invalid Requests
```bash
# Invalid platform
curl http://localhost:3000/api/growth/platform/invalid_platform

# Invalid endpoint
curl http://localhost:3000/api/growth/nonexistent
```

#### Check Error Handling
```bash
# Test with growth tracking disabled
# Set GROWTH_TRACKING_ENABLED="false" and restart
curl http://localhost:3000/api/growth/status
```

### 6. **Log Verification**

Check your application logs for:

```
📊 Initializing Growth Tracking Service...
✅ Growth Tracking Service initialized successfully
📊 Scheduled data collection for discord every 60 minutes
📊 Manual collection triggered for all platforms
✅ Collected 2 metrics from discord
```

## 🐛 Troubleshooting

### Common Issues:

1. **Service Not Starting**
   ```bash
   # Check if enabled
   echo $GROWTH_TRACKING_ENABLED
   # Should return "true"
   ```

2. **Database Tables Missing**
   ```sql
   -- Verify schema was applied
   SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'growth_%';
   ```

3. **API Endpoints Not Working**
   ```bash
   # Check if service is running
   curl http://localhost:3000/api/growth/status
   ```

4. **No Data Collecting**
   ```sql
   -- Check platform configs
   SELECT platform, collection_enabled, last_collection_status 
   FROM growth_platform_configs;
   ```

### Log Levels for Debugging:
```bash
# In .env, set for detailed debugging:
LOG_LEVEL="debug"
```

## ✅ Success Checklist

- [ ] Database tables created successfully
- [ ] Growth tracking service starts without errors
- [ ] All API endpoints return valid JSON responses
- [ ] Manual data collection works for all platforms
- [ ] Dashboard shows clean 0-value structure
- [ ] Test data insertion and analytics calculation work
- [ ] Error handling works for invalid requests
- [ ] Rate limiting is functional
- [ ] Logs show successful initialization and collection

## 🚀 Next Steps After Testing

1. **Implement API Integrations** for platforms you want to track
2. **Set up automated collection** by leaving the service running
3. **Build frontend dashboard** using the API endpoints
4. **Monitor performance** and adjust collection intervals
5. **Add real API keys** when ready for production data

Your growth tracking system is now ready for testing and development!