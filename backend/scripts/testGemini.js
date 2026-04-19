require('dotenv').config();
const { extractFromText } = require('../services/geminiService');

const testCases = [
  'करोल बाग में एक बुजुर्ग महिला गिर गई। बहुत दर्द है। डॉक्टर चाहिए।',
  'bhai 20 logo ko khana chahiye nehru place metro ke paas',
  'Family of 4 homeless after fire in Lajpat Nagar. Need shelter URGENT',
  'Emergency: 3 people injured bus accident IIT Delhi Gate 4',
];

async function testGemini() {
  console.log('🧪 Testing Gemini extraction...\n');

  for (let i = 0; i < testCases.length; i++) {
    console.log(`\n--- TEST ${i + 1} ---`);
    console.log(`Input: ${testCases[i]}`);

    const result = await extractFromText(testCases[i]);

    console.log('Output:', JSON.stringify(result, null, 2));
    console.log(`✅ Confidence: ${result.confidence}`);
  }

  console.log('\n✅ All tests complete');
  process.exit(0);
}

testGemini().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});