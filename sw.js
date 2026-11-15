// Service Worker untuk PWA MENUJU ASN (CBT SKD CPNS 2026) v2.3.5
const CACHE_NAME = 'menuju-asn-v2.4.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=2.1.5',
  './app.js?v=2.3.5',
  './firebase-config.js',
  './data_skd_cpns.js?v=2.2.0',
  './data_twk_gratis.js?v=1.0.0',
  './data_tiu_gratis.js?v=1.0.0',
  './data_tkp_gratis.js?v=1.0.0',
  './manifest.json',
  './logo%20menuju%20asn.png',
  './menang.mp3'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[MENUJU ASN SW] Pre-caching assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Cache addAll warning:', err));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[MENUJU ASN SW] Menghapus cache lama:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Jangan cache request ke Firebase Firestore / Auth
  if (url.origin.includes('firestore.googleapis.com') || 
      url.origin.includes('identitytoolkit.googleapis.com') ||
      url.origin.includes('securetoken.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
