/* ============================================================
 * 桥筏钓鱼全攻略 · Service Worker（PWA 离线缓存）
 * 策略：
 *  - install  ：预缓存核心资源（页面 / 数据 / 脚本 / manifest / 图标）
 *  - activate ：清理旧版本缓存，立即接管页面
 *  - fetch    ：同源静态资源「缓存优先、后台更新」(stale-while-revalidate)；
 *               导航请求离线时回退到 index.html
 *  - 跨域请求（天气 API 等）一律放行，不做缓存
 * 更新缓存：改动内容后把 VERSION 递增再部署，自动换新缓存。
 * ============================================================ */
const VERSION = 'qiaofa-v2.0.5';
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
  /* 只处理同源请求；跨域 API 直接放行 */
  if(url.origin !== location.origin) return;

  /* 导航请求：网络优先，失败回退缓存中的 index.html */
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* 静态资源：缓存优先 + 后台更新 */
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
