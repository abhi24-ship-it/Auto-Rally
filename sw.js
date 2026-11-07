// Service worker: saves the game files on the phone the first time it is
// opened online. After that the game loads from this cache, even in flight mode.

const CACHE = 'auto-rally-v6';   // change the number when you update the game
const FILES = [
  './',
  './index.html',
  './game.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: download and store all the files.
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }));
  self.skipWaiting();
});

// Activate: delete caches from older versions.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE; })
                              .map(function (n) { return caches.delete(n); }));
    })
  );
  self.clients.claim();
});

// Fetch: answer from the cache first, use the network only if needed.
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
