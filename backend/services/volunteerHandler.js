const { db, getVolunteer, updateTaskStatus, admin } = require('./firebaseService');
const { sendMessage } = require('./telegramService');

/**
 * Handle YES response from volunteer
 */
async function handleYes(volunteerId) {
  try {
    const volunteer = await getVolunteer(volunteerId);
    
    if (!volunteer) {
      await sendMessage(volunteerId, '❌ You\'re not registered as a volunteer.');
      return;
    }
    
    // Find tasks dispatched to this volunteer that are still unassigned
    const tasksSnapshot = await db
      .collection('tasks')
      .where('status', '==', 'dispatched')
      .where('dispatchedTo', 'array-contains', String(volunteerId))
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (tasksSnapshot.empty) {
      await sendMessage(
        volunteerId,
        '⚠️ No pending tasks found.\n\n' +
        'This task may have been assigned to someone else already.'
      );
      return;
    }
    
    const taskDoc = tasksSnapshot.docs[0];
    const task = taskDoc.data();
    const taskId = taskDoc.id;
    
    // Assign task to this volunteer
    await updateTaskStatus(taskId, 'assigned', {
      assignedVolunteer: String(volunteerId),
    });
    
    // Update volunteer's task count
    await db
      .collection('volunteers')
      .doc(String(volunteerId))
      .update({
        currentTaskCount: admin.firestore.FieldValue.increment(1),
        tasksAccepted: admin.firestore.FieldValue.increment(1),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    
    // Notify this volunteer
    await sendMessage(
      volunteerId,
      `✅ *Task assigned to you!*\n\n` +
      `📋 ${task.description}\n` +
      `📍 ${task.location}\n\n` +
      `When completed, reply: *DONE*`
    );
    
    // Notify other volunteers who were dispatched
    const otherVolunteers = task.dispatchedTo.filter((id) => id !== String(volunteerId));
    for (const otherId of otherVolunteers) {
      await sendMessage(
        otherId,
        `ℹ️ Task at ${task.location} has been assigned to another volunteer.`
      );
    }
    
    console.log(`✅ Task ${taskId} assigned to ${volunteer.name}`);
  } catch (error) {
    console.error('❌ Error handling YES:', error);
    await sendMessage(volunteerId, '❌ Error assigning task. Please try again.');
  }
}

/**
 * Handle NO response from volunteer
 */
async function handleNo(volunteerId) {
  try {
    await sendMessage(
      volunteerId,
      '👍 No problem! You won\'t be assigned this task.\n\n' +
      'You\'ll receive new opportunities soon.'
    );
    
    // Update last active time
    await db
      .collection('volunteers')
      .doc(String(volunteerId))
      .update({
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    
    console.log(`📝 Volunteer ${volunteerId} declined task`);
  } catch (error) {
    console.error('❌ Error handling NO:', error);
  }
}

/**
 * Handle DONE response from volunteer
 */
async function handleDone(volunteerId) {
  try {
    const volunteer = await getVolunteer(volunteerId);
    
    if (!volunteer) {
      await sendMessage(volunteerId, '❌ You\'re not registered as a volunteer.');
      return;
    }
    
    // Find tasks assigned to this volunteer
    const tasksSnapshot = await db
      .collection('tasks')
      .where('status', '==', 'assigned')
      .where('assignedVolunteer', '==', String(volunteerId))
      .orderBy('assignedAt', 'desc')
      .limit(1)
      .get();
    
    if (tasksSnapshot.empty) {
      await sendMessage(volunteerId, '⚠️ No active tasks found to complete.');
      return;
    }
    
    const taskDoc = tasksSnapshot.docs[0];
    const task = taskDoc.data();
    const taskId = taskDoc.id;
    
    // Mark task as completed
    await updateTaskStatus(taskId, 'completed');
    
    // Update volunteer stats
    await db
      .collection('volunteers')
      .doc(String(volunteerId))
      .update({
        currentTaskCount: admin.firestore.FieldValue.increment(-1),
        tasksCompleted: admin.firestore.FieldValue.increment(1),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    
    // Calculate new success rate
    const updatedVolunteer = await getVolunteer(volunteerId);
    const newSuccessRate = updatedVolunteer.tasksCompleted / updatedVolunteer.tasksAccepted;
    
    await db
      .collection('volunteers')
      .doc(String(volunteerId))
      .update({
        successRate: newSuccessRate,
      });
    
    // Notify volunteer
    await sendMessage(
      volunteerId,
      `🎉 *Task completed!*\n\n` +
      `Great work on:\n${task.description}\n\n` +
      `📊 Your stats:\n` +
      `✅ Completed: ${updatedVolunteer.tasksCompleted + 1}\n` +
      `📈 Success rate: ${Math.round(newSuccessRate * 100)}%`
    );
    
    console.log(`✅ Task ${taskId} completed by ${volunteer.name}`);
  } catch (error) {
    console.error('❌ Error handling DONE:', error);
    await sendMessage(volunteerId, '❌ Error completing task. Please try again.');
  }
}

module.exports = {
  handleYes,
  handleNo,
  handleDone,
};