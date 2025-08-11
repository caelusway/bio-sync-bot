# 📊 BioProtocol Growth Collector

A standalone service for collecting growth metrics from all BioProtocol platforms.

## 🚀 Quick Start

### Option 1: Interactive Startup Script (Recommended)
```bash
./scripts/start-growth-collector.sh
```

### Option 2: Direct npm Commands
```bash
# Development mode (with auto-restart)
npm run growth:dev

# Production mode
npm run growth:build

# Development without auto-restart
npm run growth
```

## 🔧 Prerequisites

### 1. Database Setup
Run these SQL files in Supabase **before** starting:
```sql
\i sql/growth_tracking_schema.sql
\i sql/growth_initial_data.sql
```

### 2. Environment Variables
Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional (platforms will be skipped if missing):
- `YOUTUBE_API_KEY` & `YOUTUBE_CHANNEL_ID`
- `LINKEDIN_ACCESS_TOKEN` & `LINKEDIN_ORGANIZATION_ID`
- `WEBFLOW_ACCESS_TOKEN` & `WEBFLOW_SITE_ID` & `WEBFLOW_FORM_ID`
- `AIRTABLE_API_KEY` & `AIRTABLE_BASE_ID` & `LUMA_AIRTABLE_TABLE_NAME`

## 📊 What It Does

### Immediate Collection (Working Now):
- ✅ **YouTube**: Channel views, subscriber count (every 2 hours)

### Planned Collection (Placeholders Ready):
- 🔄 **Discord**: Server member count, message statistics
- 🔄 **Telegram**: Chat member count, message statistics  
- 🔄 **LinkedIn**: Page follower count
- ✅ **Luma**: Subscriber count from Airtable (13,757+ subscribers)
- ✅ **Email**: Newsletter signup count from Webflow (OAuth2 ready)

### Analytics Calculation:
- **1-day change**: Growth in last 24 hours
- **7-day change**: Weekly growth comparison
- **30-day change**: Monthly growth trends
- **1-year change**: Annual growth analysis
- **Percentage changes**: For all time periods

## 🔄 Collection Schedule

- **YouTube**: Every 2 hours (API has daily quota limits)
- **Other Platforms**: Every 4 hours (when implemented)
- **Analytics**: Calculated after each collection round

## 📈 Viewing Results

### Via API (if main bot is running):
```bash
# View all growth data
curl http://localhost:3000/api/growth/dashboard

# View specific platform
curl http://localhost:3000/api/growth/platform/youtube
```

### Via Database:
```sql
-- Latest metrics for all platforms
SELECT * FROM v_latest_growth_metrics ORDER BY platform, metric_type;

-- Marketing dashboard data
SELECT * FROM v_marketing_dashboard ORDER BY platform, metric_type;

-- Raw metrics data
SELECT platform, metric_type, metric_value, recorded_at 
FROM growth_metrics 
WHERE recorded_at > NOW() - INTERVAL '7 days'
ORDER BY recorded_at DESC;
```

## 🛠️ Development

### Adding New Platform Integration:

1. **Add API collection method**:
   ```typescript
   private async collectNewPlatformMetrics(): Promise<void> {
     // Implement API calls
     await this.saveMetric(PlatformType.NEW_PLATFORM, MetricType.NEW_METRIC, value, timestamp);
   }
   ```

2. **Add to collection schedule**:
   ```typescript
   private async runCollection(): Promise<void> {
     const results = await Promise.allSettled([
       // ... existing collections
       this.collectNewPlatformMetrics()
     ]);
   }
   ```

3. **Update environment variables** and types as needed

### Custom Collection Intervals:
Modify the `setupCollectionSchedule()` method to adjust timing.

## 🚨 Troubleshooting

### Common Issues:

1. **YouTube API Errors**:
   - Check API key validity
   - Verify channel ID format (should start with 'UC')
   - Check daily quota usage in Google Cloud Console

2. **Database Connection Issues**:
   - Verify Supabase credentials
   - Ensure database migrations are applied
   - Check network connectivity

3. **Collection Failures**:
   - Review logs for specific error messages
   - Check if API credentials are correct
   - Verify API endpoints are accessible

### Monitoring:
- Check logs in console output
- Monitor database for new entries
- Use built-in error handling and retry logic

## 🔧 Production Deployment

### Using PM2:
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/growth-collector.js --name "growth-collector"

# Monitor
pm2 status
pm2 logs growth-collector
```

### Using systemd:
```bash
# Copy service file
sudo cp scripts/growth-collector.service /etc/systemd/system/

# Edit paths in service file
sudo nano /etc/systemd/system/growth-collector.service

# Enable and start
sudo systemctl enable growth-collector
sudo systemctl start growth-collector
sudo systemctl status growth-collector
```

## 📊 Expected Data Flow

1. **Collection**: Fetch data from platform APIs
2. **Storage**: Save raw metrics to `growth_metrics` table
3. **Analytics**: Calculate changes and store in `growth_analytics` table
4. **Views**: Access processed data via database views
5. **Dashboard**: Display growth charts using the analytics data

## 🔧 Webflow Integration Setup

### Step 1: Complete OAuth2 Flow
```bash
npm run webflow:oauth
```
This will:
1. Open the Webflow authorization URL in your browser
2. Guide you through the OAuth2 flow
3. Generate an access token for your `.env` file

### Step 2: Get Site and Form IDs (Optional)
The collector will automatically discover your site and forms, but you can also manually set:
- `WEBFLOW_SITE_ID`: Your site ID from Webflow
- `WEBFLOW_FORM_ID`: Your email signup form ID

### Step 3: Test Email Collection
```bash
npm run growth
```

## 📊 Airtable Integration (Luma Subscribers)

The system automatically handles pagination to collect all 13,757+ subscriber records from your Airtable. No additional setup needed beyond the API credentials in `.env`.

Perfect for building marketing dashboards and growth tracking systems! 🚀