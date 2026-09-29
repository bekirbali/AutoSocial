import 'dotenv/config';
import { redis } from '../src/lib/redis.js';

async function main() {
  const articleId = 'b488d4f8-8a78-4e33-a7ec-bfa32a1135c3';
  const caption = await redis.get('tg:caption:' + articleId);
  console.log('--- REDIS TG CAPTION ---');
  console.log(caption);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
