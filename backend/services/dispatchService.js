const { updateTaskStatus } = require('./firebaseService');
const { sendMessage } = require('./telegramService');
const { db } = require('./firebaseService'); // Directly importing db for flexibility

/**
 * Calculate match score for volunteer
 */
function calculateMatchScore(volunteer, task) {
  let score = 0;
  
  // Safety Fix: Ensure requiredSkills is handled safely
  const taskSkills = Array.isArray(task.requiredSkills) ? task.requiredSkills : [task.requiredSkills || 'general'];
  const volunteerSkills = Array.isArray(volunteer.skills) ? volunteer.skills : [];

  // Basic skill match
  const skillMatches = taskSkills.filter(skill => volunteerSkills.includes(skill)).length;
  score += skillMatches * 10;
  
  // Load Factor (Prefer volunteers with fewer tasks)
  const currentTasks = volunteer.currentTaskCount || 0;
  score += (5 - currentTasks) * 2; 
  
  return score;
}

/**
 * Select top volunteers
 */
function selectVolunteers(task, allVolunteers) {
  if (allVolunteers.length === 0) return [];
  
  const scoredVolunteers = allVolunteers
    .map(v => ({ ...v, matchScore: calculateMatchScore(v, task) }))
    .sort((a, b) => b.matchScore - a.matchScore);
  
  const selected = scoredVolunteers.slice(0, 3);
  console.log(`✅ Selected ${selected.length} volunteers for dispatch`);
  return selected;
}

/**
 * Notify volunteers via Telegram
 */
async function notifyVolunteers(volunteers, task) {
  const notifiedIds = [];
  
  for (const volunteer of volunteers) {
    try {
      // Logic: Use telegramId if exists, otherwise fallback to document ID
      const targetChatId = volunteer.telegramId || volunteer.id;
      
      const urgencyEmoji = task.urgency >= 4 ? '🚨' : '📋';
      const message = 
        `${urgencyEmoji} *NEW EMERGENCY TASK*\n\n` +
        `📍 *Location*: ${task.location || 'Unknown'}\n` +
        `📋 *Issue*: ${task.issueType?.toUpperCase() || 'General'}\n` +
        `🚨 *Urgency*: ${task.urgency}/5\n` +
        `📝 *Details*: ${task.rawInput || 'No description provided'}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `Do you want to accept this task?\n` +
        `Reply: *YES* or *NO*`;

      await sendMessage(targetChatId, message);
      notifiedIds.push(volunteer.id);
      console.log(`✅ Dispatch notification sent to: ${volunteer.name || targetChatId}`);
    } catch (error) {
      console.error(`❌ Failed to notify volunteer ${volunteer.id}:`, error.message);
    }
  }
  return notifiedIds;
}

/**
 * Main Dispatch Function
 */
async function dispatchTask(taskId, taskData = null) {
  try {
    console.log(`🚀 Starting dispatch process for task: ${taskId}`);
    
    // 1. Get Task Data
    let task = taskData;
    if (!task) {
      const doc = await db.collection('tasks').doc(taskId).get();
      if (!doc.exists) throw new Error('Task not found in DB');
      task = { id: doc.id, ...doc.data() };
    }

    // 2. Security Check
    if (task.status !== 'open') {
      console.log(`⚠️ Task ${taskId} is already ${task.status}. Skipping.`);
      return { success: false, reason: 'Task not open' };
    }

    // 3. Get Available Volunteers (SIMPLIFIED QUERY)
    // Testing ke liye hum sirf 'isAvailable' check kar rahe hain
    const volSnapshot = await db.collection('volunteers')
      .where('isAvailable', '==', true)
      .get();

    let allVolunteers = volSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 4. Log for Debugging
    console.log(`🔍 Found ${allVolunteers.length} available volunteers in DB`);

    if (allVolunteers.length === 0) {
      console.log('⚠️ No available volunteers found in Database.');
      return { success: false, reason: 'No volunteers' };
    }

    // 5. Filter & Notify
    const selectedVolunteers = selectVolunteers(task, allVolunteers);
    const notifiedIds = await notifyVolunteers(selectedVolunteers, task);

    // 6. Update Status to 'dispatched'
    if (notifiedIds.length > 0) {
      await updateTaskStatus(taskId, 'dispatched', {
        dispatchedTo: notifiedIds,
        dispatchedAt: new Date().toISOString()
      });
      console.log(`🏁 Dispatch complete for ${taskId}`);
    }

    return { success: true, notifiedCount: notifiedIds.length };

  } catch (error) {
    console.error('❌ Critical Dispatch Error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { dispatchTask };