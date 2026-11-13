// Service worker: deixa o ORBITA funcionando offline (network-first, cai no cache).
const CACHE = 'orbita-v6';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'icon.svg', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/icons.js', 'js/collections.js',
  'js/views.js', 'js/ai.js', 'js/charts.js', 'js/pixels.js', 'js/cover.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
