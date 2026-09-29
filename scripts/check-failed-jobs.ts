import 'dotenv/config';
import { processQueue } from '../src/lib/queue.js';

async function main() {
  const failedJobs = await processQueue.getFailed(0, 50);
  console.log('--- FAILED JOBS ANALİZİ ---');
  console.log('Toplam Failed Job Sayısı:', failedJobs.length);

  const map = new Map<string, { title: string; count: number; error: string }>();

  for (const job of failedJobs) {
    const url = job.data?.url || 'bilinmiyor';
    const title = job.data?.title || 'isimsiz';
    const err = job.failedReason || '';

    if (!map.has(url)) {
      map.set(url, { title, count: 1, error: err });
    } else {
      map.get(url)!.count++;
    }
  }

  console.log('Tekil Haber Sayısı:', map.size);
  let idx = 1;
  for (const [url, item] of map.entries()) {
    console.log(`${idx}. [${item.count} kez denendi] ${item.title}`);
    console.log(`   URL: ${url}`);
    console.log(`   Hata: ${item.error.slice(0, 120)}`);
    idx++;
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
