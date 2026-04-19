const { db } = require('./firebaseService');
const { sendMessage } = require('./telegramService');

async function handleYes(userId) {
  try {
    const uId = String(userId); // Ensure string format
    
    // 1. Find latest dispatched task
    const taskSnapshot = await db.collection('tasks')
      .where('status', '==', 'dispatched')
      .where('dispatchedTo', 'array-contains', uId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (taskSnapshot.empty) {
      return await sendMessage(uId, "❌ No active pending tasks found for you.");
    }

    const taskDoc = taskSnapshot.docs[0];
    
    // 2. Assign with STRICT ID matching
    await taskDoc.ref.update({
      status: 'assigned',
      assignedTo: uId, // Yahan string save ho raha hai
      assignedAt: new Date().toISOString()
    });

    await sendMessage(uId, `✅ *Task assigned to you!*\n\n📍 Location: ${taskDoc.data().location}\n\nWhen completed, reply: *DONE*`);

  } catch (error) {
    console.error('Error in handleYes:', error);
    await sendMessage(userId, "❌ Error assigning task.");
  }
}

async function handleDone(userId) {
  try {
    const uId = String(userId);
    console.log(`Checking DONE for UserID: ${uId}`);

    // 1. Search for task assigned to this EXACT string ID
    const taskSnapshot = await db.collection('tasks')
      .where('status', '==', 'assigned')
      .where('assignedTo', '==', uId)
      .limit(1)
      .get();

    if (taskSnapshot.empty) {
      return await sendMessage(uId, "❓ You don't have any active tasks to complete.");
    }

    const taskDoc = taskSnapshot.docs[0];

    // 2. Mark Completed
    await taskDoc.ref.update({
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    // 3. Update Volunteer Stats in DB
    const volRef = db.collection('volunteers').doc(uId);
    const volDoc = await volRef.get();
    let count = 1;

    if (volDoc.exists) {
      count = (volDoc.data().completedTasks || 0) + 1;
      await volRef.update({
        completedTasks: count,
        currentTaskCount: 0,
        isAvailable: true
      });
    }

    await sendMessage(uId, `🎉 *Task completed!*\n\n📊 *Your stats*:\n✅ Completed: ${count}\n📈 Success rate: 100%`);

  } catch (error) {
    console.error('Error in handleDone:', error);
    await sendMessage(userId, "❌ Error completing task.");
  }
}

module.exports = { handleYes, handleNo: (id) => sendMessage(id, "OK."), handleDone };