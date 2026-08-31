import axios from 'axios';

const sources = [
  { name: 'PC Gamer',           url: 'https://www.pcgamer.com/rss/' },
  { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed' },
  { name: 'Humble Bundle Blog', url: 'https://blog.humblebundle.com/rss' },
  { name: 'IsThereAnyDeal',     url: 'https://isthereanydeal.com/feed/' },
];

(async () => {
  console.log('🧪 Yeni RSS Kaynak Testi\n');

  for (const s of sources) {
    try {
      const res = await axios.get(s.url, {
        timeout: 8000,
        headers: { 'User-Agent': 'AutoSocial/1.0 RSS Reader' },
      });
      const body = String(res.data);
      const isRss = body.includes('<rss') || body.includes('<feed') || body.includes('<channel');
      const bytes = body.length;
      console.log(isRss ? '✅' : '⚠️ ', s.name, `— ${bytes.toLocaleString()} byte`, isRss ? '(geçerli RSS/Atom)' : '(format tanınamadı)');
    } catch (e) {
      const msg = e instanceof Error ? e.message.substring(0, 100) : String(e);
      console.log('❌', s.name, '—', msg);
    }
  }

  console.log('\nTamamlandı.');
})();
