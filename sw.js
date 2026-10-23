// TuCloset web 0.5 · caché de la aplicación: primero red (siempre lo último), caché si no hay red; el tiempo nunca se cachea
const C = 'tucloset-0.77';
const BASE = ['./', './index.html', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('open-meteo.com')) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok && u.origin === location.origin) { const cl = res.clone(); caches.open(C).then(c => c.put(e.request, cl)); } return res; }).catch(() => caches.match(e.request)));
});
