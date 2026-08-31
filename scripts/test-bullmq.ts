import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis();
const q = new Queue('test', { connection });

async function test() {
  try {
    await q.add('name', {}, { jobId: 'publish:123' });
    console.log('Success');
  } catch (err: any) {
    console.log('Error:', err.message);
  }
  process.exit(0);
}
test();
