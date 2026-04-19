const { getAvailableVolunteers, updateTaskStatus, admin } = require('./firebaseService');
const { sendMessage } = require('./telegramService');

/**
 * Calculate match score for volunteer
 */
function calculateMatchScore(volunteer, task) {
  let score = 0;
  
  // SAFETY FIX: Ensure requiredSkills is an array
  const requiredSkills = Array.isArray(task.requiredSkills) 
    ? task.requiredSkills 
    : [task.requiredSkills];

  // Skill match (most important)
  const skillMatches = requiredSkills.filter((skill) =>
    (volunteer.skills || []).includes(skill)
  ).length;
  
  score += skillMatches * 10;
  
  // Success rate bonus
  score += (volunteer.successRate || 0) * 5;
  
  // Availability (current load)
  const loadFactor = 1 - (volunteer.currentTaskCount || 0) / (volunteer.maxConcurrentTasks || 1);
  score += loadFactor * 3;
  
  // Urgency multiplier
  const urgency = parseInt(task.urgency) || 1;
  if (urgency >= 4 && skillMatches > 0) {
    score *= 1.5;
  }
  
  return score;
}

/**
 * Select top 3 volunteers for a task
 */
function selectVolunteers(task, allVolunteers) {
  if (allVolunteers.length === 0) {
    return [];
  }
  
  // Score and sort
  const scoredVolunteers = allVolunteers
    .map((volunteer) => ({
      ...volunteer,
      matchScore: calculateMatchScore(volunteer, task),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
  
  // Top 3
  const selected = scoredVolunteers.slice(0, 3);
  
  console.log(`✅ Selected ${selected.length} volunteers`);
  console.log('Top matches:', selected.map((v) => `${v.name} (${v.matchScore.toFixed(1)})`));
  
  return selected;
}

/**
 * Notify volunteers
 */
async function notifyVolunteers(volunteers, task) {
  const notifications = [];
  
  for (const volunteer of volunteers) {
    try {
      const urgencyEmoji = task.urgency >= 4 ? '🚨' : task.urgency >= 3 ? '⚠️' : '📋';
      const message =
        `${urgencyEmoji} *NEW TASK AVAILABLE*\n\n` +
        `📋 *Type*: ${task.issueType.toUpperCase()}\n` +
        `📍 *Location*: ${task.location}\n` +
        `👥 *People*: ${task.estimatedPeople}\n` +
        `🚨 *Urgency*: ${task.urgency}/5\n\n` +
        `📝 *Description*:\n${task.description}\n\n` +
        // notifyVolunteers function ke andar ye line dhundiye aur replace kijiye:
`⏱️ *Skills needed*: ${(Array.isArray(task.requiredSkills) ? task.requiredSkills : [task.requiredSkills]).join(', ') || 'general'}\n\n`  +
        `━━━━━━━━━━━━━━━━\n` +
        `Reply:\n` +
        `✅ *YES* - I'll take this\n` +
        `❌ *NO* - Can't help`;
      
      await sendMessage(volunteer.id, message);
      notifications.push(volunteer.id);
      
      console.log(`✅ Notified ${volunteer.name}`);
    } catch (error) {
      console.error(`❌ Failed to notify ${volunteer.name}:`, error);
    }
  }
  
  return notifications;
}

/**
 * Main dispatch function
 */
async function dispatchTask(taskId, taskData = null) {
  try {
    console.log(`🚀 Dispatching task: ${taskId}`);
    
    // Get task if not provided
    let task = taskData;
    if (!task) {
      const { db } = require('./firebaseService');
      const taskDoc = await db.collection('tasks').doc(taskId).get();
      
      if (!taskDoc.exists) {
        throw new Error('Task not found');
      }
      
      task = { id: taskDoc.id, ...taskDoc.data() };
    }
    
    // Don't dispatch if already dispatched/assigned
    if (task.status !== 'open') {
      console.log(`⚠️ Task ${taskId} already ${task.status}`);
      return { success: false, reason: 'Already dispatched' };
    }
    
    // Get available volunteers
    const allVolunteers = await getAvailableVolunteers(task.requiredSkills);
    
    if (allVolunteers.length === 0) {
      console.log('⚠️ No volunteers available');
      return { success: false, reason: 'No volunteers' };
    }
    
    // Select top 3
    const selectedVolunteers = selectVolunteers(task, allVolunteers);
    
    // Notify volunteers
    const notifiedIds = await notifyVolunteers(selectedVolunteers, task);
    
    // Update task status
    await updateTaskStatus(taskId, 'dispatched', {
      dispatchedTo: notifiedIds,
    });
    
    console.log(`✅ Task ${taskId} dispatched to ${notifiedIds.length} volunteers`);
    
    return {
      success: true,
      volunteersNotified: notifiedIds.length,
    };
  } catch (error) {
    console.error('❌ Dispatch error:', error);
    throw error;
  }
}

module.exports = {
  dispatchTask,
  selectVolunteers,
  calculateMatchScore,
};