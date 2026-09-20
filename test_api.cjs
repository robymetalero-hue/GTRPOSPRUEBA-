const { GoogleGenAI } = require("@google/genai");

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello'
    });
    console.log("Success with gemini-2.5-flash:", response.text);
  } catch (e) {
    console.error("Error with gemini-2.5-flash:", e);
  }
}

test();
