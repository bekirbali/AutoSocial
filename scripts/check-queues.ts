import { fetchQueue, processQueue } from '../src/lib/queue.js';

async function main() {
  console.log('Fetch Queue:', await fetchQueue.getJobCounts());
  console.log('Process Queue:', await processQueue.getJobCounts());
  process.exit(0);
}
main();
