import { BotConfig, CategoryConfig, MessageCategory, TGEPhase } from '@/types';
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

// Validate required environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Parse category configurations from environment variables
function parseCategoryConfigs(): CategoryConfig[] {
  const configs: CategoryConfig[] = [];
  
  // Pre-TGE categories
  const preTgeCategories = process.env['PRE_TGE_CATEGORIES']?.split(',') || [];
  preTgeCategories.forEach(categoryId => {
    if (categoryId.trim()) {
      configs.push({
        id: categoryId.trim(),
        name: `pre-tge-category-${categoryId.trim()}`,
        message_category: MessageCategory.CORE_GENERAL, // Will be updated based on category name
        tge_phase: TGEPhase.PRE_TGE,
        monitoring_enabled: true
      });
    }
  });

  // Post-TGE categories
  const postTgeCategories = process.env['POST_TGE_CATEGORIES']?.split(',') || [];
  postTgeCategories.forEach(categoryId => {
    if (categoryId.trim()) {
      configs.push({
        id: categoryId.trim(),
        name: `post-tge-category-${categoryId.trim()}`,
        message_category: MessageCategory.CORE_GENERAL, // Will be updated based on category name
        tge_phase: TGEPhase.POST_TGE,
        monitoring_enabled: true
      });
    }
  });

  // General monitored categories (default to PRE_TGE if not specified)
  const monitoredCategories = process.env['MONITORED_CATEGORIES']?.split(',') || [];
  monitoredCategories.forEach(categoryId => {
    if (categoryId.trim() && !configs.find(c => c.id === categoryId.trim())) {
      configs.push({
        id: categoryId.trim(),
        name: `category-${categoryId.trim()}`,
        message_category: MessageCategory.OTHER,
        tge_phase: TGEPhase.PRE_TGE,
        monitoring_enabled: true
      });
    }
  });

  // Parse category-specific configurations
  const categoryConfigsString = process.env['CATEGORY_CONFIGS'];
  if (categoryConfigsString) {
    try {
      const categoryConfigs = JSON.parse(categoryConfigsString);
      Object.entries(categoryConfigs).forEach(([categoryId, config]: [string, any]) => {
        const existingConfig = configs.find(c => c.id === categoryId);
        if (existingConfig) {
          Object.assign(existingConfig, config);
        } else {
          configs.push({
            id: categoryId,
            name: config.name || `category-${categoryId}`,
            message_category: config.message_category || MessageCategory.OTHER,
            tge_phase: config.tge_phase || TGEPhase.PRE_TGE,
            monitoring_enabled: config.monitoring_enabled !== false,
            include_patterns: config.include_patterns,
            exclude_patterns: config.exclude_patterns,
            filters: config.filters
          });
        }
      });
    } catch (error) {
      console.warn('Failed to parse CATEGORY_CONFIGS:', error);
    }
  }

  return configs;
}

// Determine category based on Discord category name
function getCategoryFromCategoryName(categoryName: string): MessageCategory {
  const name = categoryName.toLowerCase();
  
  if (name.includes('core') || name.includes('general')) return MessageCategory.CORE_GENERAL;
  if (name.includes('product')) return MessageCategory.PRODUCT;
  if (name.includes('tech')) return MessageCategory.TECH;
  if (name.includes('ai-agent') || name.includes('ai_agent')) return MessageCategory.AI_AGENTS;
  if (name.includes('ai')) return MessageCategory.AI;
  if (name.includes('design')) return MessageCategory.DESIGN;
  if (name.includes('marketing')) return MessageCategory.MARKETING;
  if (name.includes('tokenomic')) return MessageCategory.TOKENOMICS;
  if (name.includes('dao') || name.includes('program')) return MessageCategory.DAO_PROGRAM;
  if (name.includes('event')) return MessageCategory.EVENTS;
  
  return MessageCategory.OTHER;
}

// Determine category based on channel name (fallback)
function getCategoryFromChannelName(channelName: string): MessageCategory {
  const name = channelName.toLowerCase();
  
  if (name.includes('core') || name.includes('general')) return MessageCategory.CORE_GENERAL;
  if (name.includes('product')) return MessageCategory.PRODUCT;
  if (name.includes('tech')) return MessageCategory.TECH;
  if (name.includes('ai-agent') || name.includes('ai_agent')) return MessageCategory.AI_AGENTS;
  if (name.includes('ai')) return MessageCategory.AI;
  if (name.includes('design')) return MessageCategory.DESIGN;
  if (name.includes('marketing')) return MessageCategory.MARKETING;
  if (name.includes('tokenomic')) return MessageCategory.TOKENOMICS;
  if (name.includes('dao') || name.includes('program')) return MessageCategory.DAO_PROGRAM;
  if (name.includes('event')) return MessageCategory.EVENTS;
  
  return MessageCategory.OTHER;
}

// Convert glob pattern to regex pattern
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except *
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Convert * to .*
  const regexPattern = escapedPattern.replace(/\*/g, '.*');
  return new RegExp(regexPattern, 'i');
}

// Check if channel should be included based on patterns
function shouldIncludeChannel(channelName: string, includePatterns?: string[], excludePatterns?: string[]): boolean {
  const name = channelName.toLowerCase();
  
  // Check exclude patterns first
  if (excludePatterns && excludePatterns.length > 0) {
    for (const pattern of excludePatterns) {
      if (name.includes(pattern.toLowerCase()) || globToRegex(pattern).test(name)) {
        return false;
      }
    }
  }
  
  // Check include patterns
  if (includePatterns && includePatterns.length > 0) {
    for (const pattern of includePatterns) {
      if (name.includes(pattern.toLowerCase()) || globToRegex(pattern).test(name)) {
        return true;
      }
    }
    return false; // If include patterns are specified, channel must match at least one
  }
  
  return true; // Include by default if no patterns specified
}

export const botConfig: BotConfig = {
  discord: {
    token: process.env['DISCORD_BOT_TOKEN']!,
    clientId: process.env['DISCORD_CLIENT_ID']!,
    guildId: process.env['DISCORD_GUILD_ID']!
  },
  supabase: {
    url: process.env['SUPABASE_URL']!,
    anonKey: process.env['SUPABASE_ANON_KEY']!
  },
  categories: parseCategoryConfigs(),
  channels: [], // Will be populated dynamically based on categories
  rateLimiting: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000'),
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100')
  },
  logging: {
    level: process.env['LOG_LEVEL'] || 'info'
  },
  health: {
    checkInterval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '300000')
  },
  database: {
    cleanupInterval: parseInt(process.env['DB_CLEANUP_INTERVAL'] || '86400000'),
    maxMessageAgeDays: parseInt(process.env['MAX_MESSAGE_AGE_DAYS'] || '90')
  }
};

export { getCategoryFromCategoryName, getCategoryFromChannelName, shouldIncludeChannel };
export default botConfig; 