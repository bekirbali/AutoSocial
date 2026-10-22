import { env } from '../src/config/env.js';
import axios from 'axios';

async function checkModel() {
  const models = ['gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-lite'];
  for (const m of models) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: 'Merhaba, aktif misin? Tek kelimeyle cevap ver.' }] }]
        }
      );
      console.log(`✅ ${m}: AKTİF! Yanıt: "${res.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}"`);
    } catch (err: any) {
      console.log(`❌ ${m}: HATA (${err.response?.status}) -> ${JSON.stringify(err.response?.data?.error?.message || err.message)}`);
    }
  }
}

checkModel();
