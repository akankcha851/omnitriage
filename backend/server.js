const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sendMessage } = require('./services/telegramService');
const { extractFromText } = require('./services/geminiService');
const { createTask } = require('./services/firebaseService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
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
    const userId = message.from.id;
    const userName = `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim();
    const text = message.text || '';
    
    console.log(`📨 Message from ${userName} (${userId}): ${text}`);
    
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
    
    // Handle volunteer responses (we'll implement this in next block)
    const upperText = text.toUpperCase().trim();
    if (upperText === 'YES' || upperText === 'Y') {
      await sendMessage(chatId, '✅ Feature coming soon! (Day 2 afternoon)');
      return res.sendStatus(200);
    }
    
    if (upperText === 'NO' || upperText === 'N') {
      await sendMessage(chatId, '👍 No problem!');
      return res.sendStatus(200);
    }
    
    if (upperText === 'DONE' || upperText === 'D') {
      await sendMessage(chatId, '🎉 Feature coming soon! (Day 2 afternoon)');
      return res.sendStatus(200);
    }
    
    // Process as field worker report
    if (text && text.length > 0) {
      await sendMessage(chatId, '📝 Processing your report...');
      
      // Extract with Gemini
      const extracted = await extractFromText(text);
      
      // Create task in Firestore
      const taskData = {
        rawInput: text,
        source: 'telegram',
        ...extracted,
        needsReview: extracted.confidence < 0.7,
        reporterId: String(userId),
        reporterName: userName,
        hasImage: false,
        imageUrl: '',
      };
      
      const task = await createTask(taskData);
      
      // Send confirmation
      const confidenceEmoji = extracted.confidence >= 0.8 ? '✅' : '⚠️';
      const reviewNote = extracted.confidence < 0.7
        ? '\n\n⚠️ *Low confidence - will be reviewed by coordinator*'
        : '';
      
      await sendMessage(
        chatId,
        `${confidenceEmoji} *Report logged successfully*\n\n` +
        `📋 Type: ${extracted.issueType.toUpperCase()}\n` +
        `📍 Location: ${extracted.location}\n` +
        `🚨 Urgency: ${extracted.urgency}/5\n` +
        `👥 People affected: ${extracted.estimatedPeople}\n` +
        `🎯 Confidence: ${Math.round(extracted.confidence * 100)}%` +
        reviewNote
      );
      
      console.log(`✅ Task ${task.id} created successfully`);
    }
    
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