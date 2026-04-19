const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Send message to user
 */
async function sendMessage(chatId, text, options = {}) {
  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      ...options,
    });
    console.log(`✅ Message sent to ${chatId}`);
  } catch (error) {
    console.error('❌ Error sending message:', error);
  }
}

module.exports = {
  sendMessage,
  bot,
};