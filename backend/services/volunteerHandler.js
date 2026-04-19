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
async function handleDone(userId) {
  try {
    console.log(`Checking task for user: ${userId}`);
    
    // 1. Task dhoondne ke liye query (userId ko String mein convert karke)
    const taskSnapshot = await db.collection('tasks')
      .where('status', '==', 'assigned')
      .where('assignedTo', '==', String(userId))
      .limit(1)
      .get();

    if (taskSnapshot.empty) {
      console.log(`No assigned task found for ${userId}`);
      return await sendMessage(userId, "❓ You don't have any active tasks to complete.");
    }

    const taskDoc = taskSnapshot.docs[0];
    const taskData = taskDoc.data();

    // 2. Task status ko 'completed' mark karein
    await taskDoc.ref.update({
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    // 3. Volunteer ki availability aur stats update karein
    const volRef = db.collection('volunteers').doc(String(userId));
    const volDoc = await volRef.get();
    
    let totalCompleted = 1;

    if (volDoc.exists) {
      const currentStats = volDoc.data();
      totalCompleted = (currentStats.completedTasks || 0) + 1;
      
      await volRef.update({
        completedTasks: totalCompleted,
        currentTaskCount: 0, // Task khatam, load zero
        isAvailable: true    // Ab volunteer phir se free hai
      });
    }

    // 4. Success Message with Stats
    const message = 
      `🎉 *Task completed!*\n\n` +
      `Great work on:\n${taskData.rawInput || 'Emergency Report'}\n\n` +
      `📊 *Your stats*:\n` +
      `✅ Total Completed: ${totalCompleted}\n` +
      `📈 Success rate: 100%`;

    await sendMessage(userId, message);
    console.log(`✅ Task ${taskDoc.id} marked DONE by ${userId}`);

  } catch (error) {
    console.error('❌ Error in handleDone:', error);
    await sendMessage(userId, "❌ Error completing task. Please try again.");
  }
}

module.exports = {
  handleYes,
  handleNo,
  handleDone,
};