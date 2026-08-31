import { fetchQueue } from '../src/lib/queue.js';
import { closeRedis } from '../src/lib/redis.js';

async function main() {
  await fetchQueue.add('manual-fetch', { triggeredBy: 'manual', timestamp: Date.now() });
  console.log('✅ Fetch tetiklendi');
  process.exit(0);
}
main();
