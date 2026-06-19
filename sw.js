const CACHE_NAME = 'barber-coach-v1';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './src/app.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

const FALLBACK_URL = '/index.html';

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  // navigation requests -> serve index.html (SPA friendly)
  if (evt.request.mode === 'navigate'){
    evt.respondWith(
      fetch(evt.request).catch(()=>caches.match(FALLBACK_URL))
    );
    return;
  }

  evt.respondWith(
    caches.match(evt.request).then((resp) => resp || fetch(evt.request).then(r=>{
      // runtime cache responses for images and scripts
      if (!resp && evt.request.url.startsWith(self.location.origin)){
        caches.open(CACHE_NAME).then(cache=>{ try{ cache.put(evt.request, r.clone()); }catch(e){} });
      }
      return r;
    }).catch(()=>caches.match(evt.request)))
  );
});
