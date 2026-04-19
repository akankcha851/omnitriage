const admin = require('firebase-admin');

// Load service account
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('../serviceAccount.json');
}

// Prevent double initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ⚠️ YOUR TELEGRAM ID
const YOUR_TELEGRAM_ID = '5338954102'; 

const volunteers = [
  {
    id: '5338954102',
    name: 'Akankcha (Test Volunteer)',
    phone: '+919999999999',
    // Isme humne saari possibilities daal di hain
    skills: ['medical', 'Medical Emergency', 'Medical Incident', 'transport'],
    isAvailable: true,
    maxConcurrentTasks: 10,
    currentTaskCount: 0,
    area: 'IIT Delhi', // <--- IMPORTANT: Task location se match hona chahiye
    tasksCompleted: 0,
    tasksAccepted: 0,
    successRate: 0,
    joinedAt: admin.firestore.Timestamp.now(),
    lastActiveAt: admin.firestore.Timestamp.now(),
  },
  {
    id: '1001',
    name: 'Dr. Priya Sharma',
    phone: '+919876543210',
    skills: ['medical', 'Medical Incident', 'Medical Emergency', 'translation_hindi'],
    isAvailable: true,
    maxConcurrentTasks: 2,
    currentTaskCount: 0,
    area: 'IIT Delhi', // Matches your "IIT Delhi" test case
    tasksCompleted: 15,
    tasksAccepted: 18,
    successRate: 0.83,
    joinedAt: admin.firestore.Timestamp.now(),
    lastActiveAt: admin.firestore.Timestamp.now(),
  },
  {
    id: '1002',
    name: 'Rajesh Kumar',
    phone: '+919876543211',
    skills: ['transport', 'food_distribution', 'Food Assistance', 'Accident'],
    isAvailable: true,
    maxConcurrentTasks: 3,
    currentTaskCount: 0,
    area: 'Nehru Place', // Matches your "Nehru Place" test case
    tasksCompleted: 22,
    tasksAccepted: 25,
    successRate: 0.88,
    joinedAt: admin.firestore.Timestamp.now(),
    lastActiveAt: admin.firestore.Timestamp.now(),
  }
];

async function seedVolunteers() {
  console.log('🌱 Seeding updated volunteers with correct skills...\n');
  
  try {
    const batch = db.batch();
    
    volunteers.forEach((volunteer) => {
      // Ensuring ID is a string to prevent Firestore path errors
      const docId = String(volunteer.id);
      const ref = db.collection('volunteers').doc(docId);
      batch.set(ref, volunteer);
      console.log(`✅ Queued: ${volunteer.name} (ID: ${docId})`);
    });
    
    await batch.commit();
    console.log(`\n✅ Successfully seeded ${volunteers.length} volunteers!`);
    console.log('💡 Now run: node testDispatch.js');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding volunteers:', error);
    process.exit(1);
  }
}

seedVolunteers();