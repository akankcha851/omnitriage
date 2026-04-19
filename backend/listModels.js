require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkMyModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // This lists EVERYTHING your key can actually talk to
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log("--- YOUR KEY'S ALLOWED MODELS ---");
    if (data.models) {
      data.models.forEach(m => {
        console.log(`Model ID: ${m.name.split('/')[1]}`);
      });
    } else {
      console.log("No models found. Your API key might be invalid or restricted.");
      console.log("API Response:", data);
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

checkMyModels();