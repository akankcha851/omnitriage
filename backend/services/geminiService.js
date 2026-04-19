const { GoogleGenerativeAI } = require("@google/generative-ai");

// Aapki key .env se load ho rahi hai
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractFromText(text) {
  try {
    // 2026 ka stable model jo aapki list mein top par hai
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.5-flash" },
      { apiVersion: 'v1' }
    );

    const prompt = `Extract info from this text and return ONLY a JSON object: "${text}". 
    Fields: issueType, description, location, urgency, requiredSkills, estimatedPeople, language, confidence.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    
    // JSON cleaning (backticks hatane ke liye)
    const cleanedJson = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanedJson);

  } catch (error) {
    console.error("❌ Gemini Error:", error.message);
    return {
      issueType: "other",
      description: text,
      location: "Unknown",
      urgency: 3,
      confidence: 0.3
    };
  }
}

module.exports = { extractFromText };