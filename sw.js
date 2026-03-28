const CACHE_NAME = 'german-course-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/flashcards.html',
    '/flashcards.js',
    '/vocabulary.html',
    '/markdown-viewer.html',
    '/styles.css',
    '/config.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// Install: cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network first for CSV/MD files, cache first for static assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // CSV and markdown files: network first, fall back to cache
    if (url.pathname.endsWith('.csv') || url.pathname.endsWith('.md')) {
        event.respondWith(
            fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // Static assets: cache first, fall back to network
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // CDN assets: cache first, fall back to network
    if (url.hostname === 'cdn.jsdelivr.net') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // External requests: network only
    event.respondWith(fetch(event.request));
});
