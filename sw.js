const CACHE_NAME = 'survey-app-v5-luxury';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './designers.js',
    './logo.jpg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
