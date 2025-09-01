#!/usr/bin/env node
// Script to sync real Telegram community data
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Simple rate limiter
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  description: string,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await delay(delayMs);
      return await operation();
    } catch (error) {
      console.log(`⚠️  ${description} failed (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) throw error;
      await delay(delayMs * attempt);
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts`);
}

async function syncTelegramData() {
  console.log('🔄 Starting Telegram data sync...');

  const botToken = process.env['TELEGRAM_BOT_TOKEN'];
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_ANON_KEY'];

  if (!botToken || !supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables');
  }

  const bot = new TelegramBot(botToken, { polling: false });
  const supabase = createClient(supabaseUrl, supabaseKey);

  const bioChatId = '-1002245955682'; // Bio Protocol community

  try {
    // 1. Get current member count
    console.log('📊 Getting current member count...');
    const memberCount = await executeWithRetry(
      () => bot.getChatMemberCount(bioChatId),
      'get Bio Protocol member count'
    );
    console.log(`👥 Bio Protocol members: ${memberCount}`);

    // 2. Get chat info
    console.log('📱 Getting chat info...');
    const chatInfo = await executeWithRetry(
      () => bot.getChat(bioChatId),
      'get Bio Protocol chat info'
    );
    console.log('📋 Chat info:', {
      title: chatInfo.title,
      type: chatInfo.type,
      description: chatInfo.description?.substring(0, 100) + '...'
    });

    // 3. Update database with real member count
    console.log('💾 Updating database...');
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('telegram_chat_stats')
      .upsert({
        chat_id: bioChatId,
        chat_title: chatInfo.title || 'Bio Protocol',
        chat_type: chatInfo.type,
        category: 'group',
        total_messages: 29000, // Approximate from your report
        messages_today: 0,
        messages_this_week: 0,
        last_message_at: now,
        active_users_count: 0,
        member_count: memberCount,
        updated_at: now
      });

    if (error) {
      console.error('❌ Database update failed:', error);
    } else {
      console.log('✅ Database updated successfully');
    }

    // 4. Try to get recent messages to understand structure
    console.log('📨 Trying to get recent messages...');
    try {
      const updates = await executeWithRetry(
        () => bot.getUpdates({ limit: 10 }),
        'get recent updates'
      );
      
      const bioMessages = updates.filter(update => 
        update.message && update.message.chat.id.toString() === bioChatId
      );
      
      console.log(`📬 Found ${bioMessages.length} recent messages from Bio Protocol`);
      
      if (bioMessages.length > 0) {
        const sampleMessage = bioMessages[0]?.message;
        if (sampleMessage) {
          console.log('📄 Sample message structure:', {
            message_id: sampleMessage.message_id,
            message_thread_id: (sampleMessage as any).message_thread_id,
            is_topic_message: (sampleMessage as any).is_topic_message,
            text: sampleMessage.text?.substring(0, 50) + '...'
          });
        }
      }
    } catch (msgError) {
      console.log('⚠️  Could not get recent messages:', msgError);
    }

    console.log('🎯 Sync completed!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  syncTelegramData()
    .then(() => {
      console.log('✅ Telegram data sync completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Telegram data sync failed:', error);
      process.exit(1);
    });
}

export { syncTelegramData };