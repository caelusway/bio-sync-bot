#!/bin/bash
# BioProtocol Growth Collector Startup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 BioProtocol Growth Collector Startup${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${RED}❌ Error: .env file not found at $PROJECT_DIR/.env${NC}"
    echo -e "${YELLOW}Please create .env file with required credentials${NC}"
    exit 1
fi

# Check required environment variables
echo -e "${BLUE}📋 Checking environment variables...${NC}"

# Source the .env file
set -a
source "$PROJECT_DIR/.env"
set +a

REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_ANON_KEY")
OPTIONAL_VARS=("YOUTUBE_API_KEY" "YOUTUBE_CHANNEL_ID" "LINKEDIN_ACCESS_TOKEN" "WEBFLOW_API_TOKEN")

MISSING_REQUIRED=()
MISSING_OPTIONAL=()

# Check required variables
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_REQUIRED+=("$var")
    else
        echo -e "${GREEN}✅ $var is set${NC}"
    fi
done

# Check optional variables
for var in "${OPTIONAL_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_OPTIONAL+=("$var")
    else
        echo -e "${GREEN}✅ $var is set${NC}"
    fi
done

# Report missing required variables
if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_REQUIRED[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    exit 1
fi

# Report missing optional variables
if [ ${#MISSING_OPTIONAL[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing optional environment variables (platforms will be skipped):${NC}"
    for var in "${MISSING_OPTIONAL[@]}"; do
        echo -e "${YELLOW}   - $var${NC}"
    done
fi

echo ""

# Check if database migrations are applied
echo -e "${BLUE}🗄️  Checking database setup...${NC}"
echo -e "${YELLOW}Please ensure you have run the following SQL files in Supabase:${NC}"
echo -e "${YELLOW}   1. sql/growth_tracking_schema.sql${NC}"
echo -e "${YELLOW}   2. sql/growth_initial_data.sql${NC}"
echo ""

# Ask for confirmation
read -p "Have you applied the database migrations? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please apply database migrations first${NC}"
    echo -e "${BLUE}Instructions:${NC}"
    echo -e "1. Open Supabase SQL Editor"
    echo -e "2. Run: \\i sql/growth_tracking_schema.sql"
    echo -e "3. Run: \\i sql/growth_initial_data.sql"
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build

# Check build success
if [ ! -f "dist/growth-collector.js" ]; then
    echo -e "${RED}❌ Build failed - dist/growth-collector.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"
echo ""

# Ask how to run
echo -e "${BLUE}🎯 How would you like to run the Growth Collector?${NC}"
echo -e "1. ${GREEN}Development mode${NC} (with auto-restart on changes)"
echo -e "2. ${BLUE}Production mode${NC} (built version)"
echo -e "3. ${YELLOW}One-time collection${NC} (run once and exit)"
echo ""

read -p "Choose option (1-3): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo -e "${GREEN}🔄 Starting in development mode...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        sleep 2
        npm run growth:dev
        ;;
    2)
        echo -e "${BLUE}🚀 Starting in production mode...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        sleep 2
        npm run growth:build
        ;;
    3)
        echo -e "${YELLOW}🔄 Running one-time collection...${NC}"
        node dist/growth-collector.js &
        PID=$!
        
        # Wait a bit for collection to complete
        sleep 30
        
        # Check if process is still running
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}⏳ Collection still running, waiting...${NC}"
            wait $PID
        fi
        
        echo -e "${GREEN}✅ One-time collection completed${NC}"
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac