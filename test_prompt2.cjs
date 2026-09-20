const { GoogleGenAI } = require("@google/genai");

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Actúa como un analista financiero experto en retail. Analiza los siguientes datos de ventas de los últimos días y los productos más vendidos. Dame 3 sugerencias breves, concretas y de alto impacto (máximo 2 oraciones cada una) para mejorar las ganancias, gestionar el inventario, o crear promociones. Datos de ventas diarias: []. Productos top: []. Responde EXCLUSIVAMENTE en un array JSON con el formato [{"title": "título corto", "description": "tu sugerencia"}]. No uses bloques de código markdown, solo el texto JSON crudo.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt
    });
    console.log("Success:", response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
