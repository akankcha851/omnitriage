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
/**
 * Get available volunteers (REPLACED WITH SMART MATCH)
 */
async function getAvailableVolunteers(requiredSkills = []) {
  try {
    // 1. Pehle ye safety line add karein:
    // Agar requiredSkills array nahi hai, toh use array mein convert kar do
    const skillsArray = Array.isArray(requiredSkills) ? requiredSkills : [requiredSkills];

    const snapshot = await db.collection('volunteers')
      .where('isAvailable', '==', true)
      .where('currentTaskCount', '<', 5)
      .get();
    
    if (snapshot.empty) {
      console.log('⚠️ No volunteers available in DB');
      return [];
    }
    
    const volunteers = [];
    
    // 2. Ab 'skillsArray' use karein (requiredSkills ki jagah)
    const normalizedRequired = skillsArray.map(s => String(s).toLowerCase());

    snapshot.forEach((doc) => {
      const volunteer = { id: doc.id, ...doc.data() };
      const volunteerSkills = (volunteer.skills || []).map(s => String(s).toLowerCase());

      if (normalizedRequired.length > 0) {
        const hasSkill = normalizedRequired.some((reqSkill) => 
          volunteerSkills.some(volSkill => volSkill.includes(reqSkill) || reqSkill.includes(volSkill))
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