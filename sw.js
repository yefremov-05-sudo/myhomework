/* MyHomework · сервис-воркер
   Нужен для установки приложения и работы без интернета.
   Стратегия: сначала сеть (чтобы правки сайта подхватывались сразу),
   при отсутствии связи отдаём последнюю сохранённую версию. */
const CACHE = 'myhomework-v1';

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(
        fetch(req).then(function (res) {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
            return res;
        }).catch(function () {
            return caches.match(req).then(function (hit) {
                return hit || caches.match('index.html') || caches.match('./');
            });
        })
    );
});
