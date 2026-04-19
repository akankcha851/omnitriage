require('dotenv').config();
const admin = require('firebase-admin');

// Load service account
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('../serviceAccount.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const { dispatchTask } = require('../services/dispatchService');

async function testDispatch() {
  console.log('🧪 Testing dispatch logic...\n');
  
  try {
    const db = admin.firestore();
    
    // Get first open task
    const tasksSnapshot = await db
      .collection('tasks')
      .where('status', '==', 'open')
      .limit(1)
      .get();
    
    if (tasksSnapshot.empty) {
      console.log('❌ No open tasks found.');
      console.log('💡 Send a message to your bot first!');
      process.exit(1);
    }
    
    const taskDoc = tasksSnapshot.docs[0];
    const task = { id: taskDoc.id, ...taskDoc.data() };
    
    console.log(`Found task: ${task.id}`);
    console.log(`Type: ${task.issueType}`);
    console.log(`Location: ${task.location}\n`);
    
    // Dispatch it
    const result = await dispatchTask(task.id, task);
    
    console.log('\n✅ Dispatch test complete!');
    console.log('Result:', result);
    console.log('\n💡 Check your Telegram for notification!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDispatch();