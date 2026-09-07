// MyHomework service worker
// Bumped when the app shell changes (e.g. the Stories feature added here) so
// that users who already installed the PWA pick up the update automatically
// instead of being stuck on a stale cached index.html.
const CACHE_VERSION = 'v8-mobile-adaptation';
const APP_CACHE = `myhomework-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `myhomework-runtime-${CACHE_VERSION}`;

// The app is a single-file PWA: index.html carries all the CSS/JS inline,
// so that's really the only thing that needs to be precached as the "shell".
const APP_SHELL = [
    './',
    './index.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE)
            .then((cache) => cache.addAll(APP_SHELL))
            // Activate this version immediately instead of waiting for old
            // tabs to close — otherwise people can be stuck on an outdated
            // cached copy of the app for a long time.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== APP_CACHE && key !== RUNTIME_CACHE)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Lets a page force an update check (e.g. a "new version available" banner
// could call navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'})).
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
        (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

function isFirebaseRequest(url) {
    return url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firebasestorage.app') ||
        url.hostname.includes('firebaseapp.com') ||
        url.hostname.includes('google.com');
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Never intercept Firebase (auth/Firestore/Storage) traffic — it needs to
    // hit the network directly for real-time data (homework, chat, stories, etc.).
    if (isFirebaseRequest(url)) return;

    // App shell (index.html / "./"): network-first so a freshly deployed
    // version (like this Stories feature) is picked up as soon as the device
    // is online, with the cached copy only as an offline fallback.
    if (isNavigationRequest(request)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(APP_CACHE).then((cache) => cache.put('./index.html', copy));
                    return response;
                })
                .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
        );
        return;
    }

    // Everything else (CDN scripts for React/Babel/Tailwind, fonts, etc.):
    // stale-while-revalidate so repeat visits load instantly but still
    // refresh quietly in the background.
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
