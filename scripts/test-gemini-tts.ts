import { env } from '../src/config/env.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function testGeminiAudio() {
  const text = "PS6 gerçekten elli bin lira mı olacak? Sony'nin yeni nesil konsolu kırk TFLOPS gücünde olabilir. Bu da PS5'in tam üç katı demek! Sizce bu güce değer mi? Yorumlarda buluşalım, TeknoFiltre'yi takip etmeyi unutmayın.";

  // Available models to test:
  const candidateModels = [
    'gemini-2.5-flash-preview-tts',
    'gemini-3.8-flash-tts',
    'gemini-2.5-flash'
  ];

  for (const model of candidateModels) {
    console.log(`\nTesting model: ${model}...`);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      
      const payload: any = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Enerjik, samimi ve akıcı bir YouTube Shorts / Reels sunucusu gibi Türkçe oku. Robotik olma, merak uyandırıcı ve doğal konuş:\n\n${text}`
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck"
              }
            }
          }
        }
      };

      const res = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Response status:', res.status);
      const candidates = res.data?.candidates;
      if (!candidates || candidates.length === 0) {
        console.log('No candidates returned:', JSON.stringify(res.data, null, 2));
        continue;
      }

      const parts = candidates[0]?.content?.parts || [];
      console.log(`Candidate has ${parts.length} parts.`);

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.inlineData) {
          console.log(`Part ${i}: mimeType = ${part.inlineData.mimeType}, data length = ${part.inlineData.data?.length}`);
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          const ext = part.inlineData.mimeType?.includes('wav') ? 'wav' : (part.inlineData.mimeType?.includes('mp3') ? 'mp3' : 'audio');
          const outDir = path.resolve('output');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const outPath = path.join(outDir, `gemini_tts_${model.replace(/[^a-z0-9]/gi, '_')}.${ext}`);
          fs.writeFileSync(outPath, buffer);
          console.log(`SAVED AUDIO TO: ${outPath} (${buffer.length} bytes)`);
          return outPath;
        } else if (part.text) {
          console.log(`Part ${i} text:`, part.text.slice(0, 100));
        }
      }
    } catch (err: any) {
      console.error(`Error on model ${model}:`, err.response?.data || err.message);
    }
  }
}

testGeminiAudio().catch(console.error);
