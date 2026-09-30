/* ============================================================
 * 妗ョ瓘閽撻奔鍏ㄦ敾鐣?路 Service Worker锛圥WA 绂荤嚎缂撳瓨锛? * 绛栫暐锛? *  - install  锛氶缂撳瓨鏍稿績璧勬簮锛堥〉闈?/ 鏁版嵁 / 鑴氭湰 / manifest / 鍥炬爣锛? *  - activate 锛氭竻鐞嗘棫鐗堟湰缂撳瓨锛岀珛鍗虫帴绠￠〉闈? *  - fetch    锛氱粺涓€銆岀綉缁滀紭鍏堛€嶏紙鑱旂綉鏃舵案杩滄嬁鏈€鏂版枃浠讹紝鏂綉鎵嶅洖閫€缂撳瓨锛夛紝
 *               閬垮厤鍑虹幇銆岄〉闈㈡柊銆佽剼鏈棫銆嶇殑鐗堟湰鍓茶
 *  - 璺ㄥ煙璇锋眰锛堝ぉ姘?API 绛夛級涓€寰嬫斁琛岋紝涓嶅仛缂撳瓨
 * 鏇存柊缂撳瓨锛氭敼鍔ㄥ唴瀹瑰悗鎶?VERSION 閫掑鍐嶉儴缃诧紝鑷姩鎹㈡柊缂撳瓨銆? * ============================================================ */
const VERSION = 'qiaofa-v2.3.3';
const CACHE = 'qiaofa-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './data.js',
  './app.js',
  './app2.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;

  let url;
  try{ url = new URL(req.url); }catch(e){ return; }
  /* 鍙鐞嗗悓婧愯姹傦紱璺ㄥ煙 API 鐩存帴鏀捐 */
  if(url.origin !== location.origin) return;

  /* 缁熶竴绛栫暐锛氱綉缁滀紭鍏堬紙淇濊瘉椤甸潰/鑴氭湰/鏁版嵁姘歌繙鏈€鏂帮級锛屾柇缃戞椂鍥為€€缂撳瓨 */
  event.respondWith(
    fetch(req)
      .then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => {
        if(hit) return hit;
        if(req.mode === 'navigate') return caches.match('./index.html');
        return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }))
  );
});
