// Service worker: red primero, y si no hay conexión, lo último que se vio.
const V = 'tiempo-v1';
const BASE = ['./', 'index.html', 'style.css', 'app.js', 'riesgos.js', 'extras.js', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(V).then(c => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
