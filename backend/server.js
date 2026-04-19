const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Added for keep-alive
require('dotenv').config();

const { sendMessage } = require('./services/telegramService');
const { extractFromText } = require('./services/geminiService');
const { createTask } = require('./services/firebaseService');
const { dispatchTask } = require('./services/dispatchService'); // Added dispatch import

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

/**
 * Manual Dispatch Route
 * Useful for coordinator dashboard to trigger dispatch manually
 */
app.post('/dispatch', async (req, res) => {
  try {
    const { taskId } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'taskId required',
      });
    }
    
    const result = await dispatchTask(taskId);
    res.json(result);
  } catch (error) {
    console.error('❌ Manual dispatch error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Telegram Webhook
 * Processes incoming reports from field workers
 */
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
    
    // Handle simple volunteer responses
    const upperText = text.toUpperCase().trim();
    if (upperText === 'YES' || upperText === 'Y') {
      await sendMessage(chatId, '✅ Received! Looking for assignments...');
      return res.sendStatus(200);
    }
    
    if (upperText === 'NO' || upperText === 'N') {
      await sendMessage(chatId, '👍 No problem!');
      return res.sendStatus(200);
    }
    
    // Process as field worker report
    if (text && text.length > 0) {
      await sendMessage(chatId, '📝 Processing your report...');
      
      // Extract data using Gemini AI
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
        status: 'open', // Explicitly set as open for poller
      };
      
      const task = await createTask(taskData);
      
      // Send confirmation back to reporter
      const confidenceEmoji = extracted.confidence >= 0.8 ? '✅' : '⚠️';
      const reviewNote = extracted.confidence < 0.7
        ? '\n\n⚠️ *Low confidence - will be reviewed by coordinator*'
        : '\n\n🚀 *High confidence - auto-dispatching to volunteers!*';
      
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

/**
 * AUTO-DISPATCH POLLER
 * Checks for 'open' tasks with high confidence every 10 seconds
 */
async function checkAndDispatchTasks() {
  try {
    const { db } = require('./services/firebaseService');
    
    // Find tasks that are 'open' and have high confidence
    const snapshot = await db
      .collection('tasks')
      .where('status', '==', 'open')
      .where('confidence', '>=', 0.7)
      .get();

    if (snapshot.empty) {
      return; // No pending tasks
    }

    console.log(`🔍 Poller: Found ${snapshot.docs.length} high-confidence tasks to dispatch`);

    for (const doc of snapshot.docs) {
      const task = { id: doc.id, ...doc.data() };
      console.log(`🚀 Auto-dispatching Task ID: ${task.id}`);

      try {
        await dispatchTask(task.id, task);
      } catch (error) {
        console.error(`❌ Failed to dispatch ${task.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Poller error:', error.message);
  }
}

/**
 * KEEP-ALIVE PINGER
 * Prevents Render from putting the free-tier server to sleep
 */
const RENDER_URL = process.env.RENDER_URL || `http://localhost:${process.env.PORT || 3000}`;
async function keepAlive() {
  try {
    await axios.get(RENDER_URL);
    console.log('✅ Keep-alive ping successful');
  } catch (error) {
    // Fail silently
  }
}

// SERVER INITIALIZATION
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Server running on port ${PORT}
  🔄 Auto-dispatch poller: ACTIVE (10s)
  💚 Keep-alive pinger: ${process.env.RENDER_URL ? 'ACTIVE' : 'INACTIVE (Local)'}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Start the background poller
  setInterval(checkAndDispatchTasks, 10000);

  // Start keep-alive if on Render
  if (process.env.RENDER_URL) {
    setInterval(keepAlive, 600000); // 10 minutes
  }
});