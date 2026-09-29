import { generateVoiceoverWithSubtitles } from '../src/modules/processor/ttsService.js';
import fs from 'fs';

async function main() {
  const script = 'PS6 gerçekten elli bin lira mı olacak? Sony nin yeni nesil konsolu kırk TFLOPS gücünde olabilir. Bu da PS5 in tam üç katı demek. Sizce bu güce değer mi? Yorumlarda buluşalım, TeknoFiltre yi takip etmeyi unutmayın.';
  
  console.log('Testing TTS and Subtitles generation...');
  const result = await generateVoiceoverWithSubtitles(script, {
    baseFileName: 'test_reels_ahmet',
    wordsPerCue: 3,
  });

  console.log('Result:', result);
  console.log('SRT content:');
  console.log(fs.readFileSync(result.srtPath, 'utf8'));
}

main().catch(console.error);
