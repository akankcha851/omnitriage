const admin = require('firebase-admin');

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Production (Render)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Local development
  serviceAccount = require('../serviceAccount.json');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Create a new task in Firestore
 */
async function createTask(taskData) {
  try {
    const taskRef = db.collection('tasks').doc();
    const task = {
      ...taskData,
      id: taskRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'open',
    };
    
    await taskRef.set(task);
    console.log(`✅ Task created: ${taskRef.id}`);
    return task;
  } catch (error) {
    console.error('❌ Error creating task:', error);
    throw error;
  }
}

/**
 * Get available volunteers
 */
async function getAvailableVolunteers(requiredSkills = []) {
  try {
    const snapshot = await db.collection('volunteers')
      .where('isAvailable', '==', true)
      .where('currentTaskCount', '<', 2)
      .get();
    
    if (snapshot.empty) {
      console.log('⚠️ No available volunteers');
      return [];
    }
    
    const volunteers = [];
    snapshot.forEach((doc) => {
      const volunteer = { id: doc.id, ...doc.data() };
      
      // Filter by skill match if skills required
      if (requiredSkills.length > 0) {
        const hasSkill = requiredSkills.some((skill) =>
          volunteer.skills.includes(skill)
        );
        if (hasSkill) {
          volunteers.push(volunteer);
        }
      } else {
        volunteers.push(volunteer);
      }
    });
    
    console.log(`✅ Found ${volunteers.length} available volunteers`);
    return volunteers;
  } catch (error) {
    console.error('❌ Error getting volunteers:', error);
    return [];
  }
}

/**
 * Update task status
 */
async function updateTaskStatus(taskId, status, additionalData = {}) {
  try {
    const updateData = {
      status,
      ...additionalData,
    };
    
    // Add timestamps based on status
    if (status === 'dispatched') {
      updateData.dispatchedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'assigned') {
      updateData.assignedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'completed') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await db.collection('tasks').doc(taskId).update(updateData);
    console.log(`✅ Task ${taskId} status → ${status}`);
  } catch (error) {
    console.error('❌ Error updating task:', error);
    throw error;
  }
}

/**
 * Get volunteer by ID
 */
async function getVolunteer(telegramId) {
  try {
    const doc = await db.collection('volunteers').doc(String(telegramId)).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('❌ Error getting volunteer:', error);
    return null;
  }
}

module.exports = {
  db,
  admin,
  createTask,
  getAvailableVolunteers,
  updateTaskStatus,
  getVolunteer,
};