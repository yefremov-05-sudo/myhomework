const CACHE_NAME = 'myhomework-cache-v2';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Для самой страницы (HTML) — сначала пробуем сеть, чтобы пользователи
  // сразу получали новую версию приложения после каждого обновления index.html.
  // Если сети нет — отдаём последнюю сохранённую копию (офлайн-режим).
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Остальные запросы — кэш, если есть, иначе сеть.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
