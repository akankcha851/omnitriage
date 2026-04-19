const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sendMessage } = require('./services/telegramService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OmniTriage Backend is Live! 🚀',
    timestamp: new Date().toISOString(),
  });
});

// Telegram webhook
app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message;
    
    if (!message) {
      return res.sendStatus(200);
    }
    
    const chatId = message.chat.id;
    const text = message.text || '';
    
    console.log(`📨 Received from ${chatId}: ${text}`);
    
    // Handle /start command
    if (text === '/start') {
      await sendMessage(
        chatId,
        '👋 *Welcome to OmniTriage*\n\n' +
        '🆘 *Field Workers*: Send reports (text/photo)\n' +
        '🚑 *Volunteers*: Reply YES/NO/DONE to tasks\n\n' +
        'Any language supported!'
      );
      return res.sendStatus(200);
    }
    
    // For now, just echo back
    await sendMessage(chatId, `📝 Received: ${text}\n\n(Processing will be added on Day 2)`);
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});