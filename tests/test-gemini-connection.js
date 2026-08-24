require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  console.log('Testing Gemini with key length:', apiKey ? apiKey.length : 'none');
  if (!apiKey) throw new Error('No API key found in .env');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent('Explain what an ambiguous requirement is in 1 short sentence.');
  const response = await result.response;
  console.log('Gemini Response:\n', response.text());
}

testGemini().catch(err => {
  console.error('Gemini test error:', err.message);
});
