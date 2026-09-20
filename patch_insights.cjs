const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldCode = `      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      const insightsText = response.text || '[]';`;

const newCode = `      let insightsText = '[]';
      try {
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash', // Fallback to gemini-2.0-flash which might have less demand, or just catch it
          contents: prompt
        });
        insightsText = response.text || '[]';
      } catch (geminiError) {
        console.error("Gemini API Error:", geminiError);
        // Fallback to static insights if API is overwhelmed
        insightsText = JSON.stringify([
            { title: "Servicio Ocupado", description: "El servicio de IA está experimentando alta demanda. Los insights generados estarán disponibles pronto." }
        ]);
      }`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('server.ts', content);
