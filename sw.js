// TuCloset web 0.5 · caché de la aplicación: primero red (siempre lo último), caché si no hay red; el tiempo nunca se cachea
const C = 'tucloset-0.272';
const BASE = ['./', './index.html', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('open-meteo.com')) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok && u.origin === location.origin) { const cl = res.clone(); caches.open(C).then(c => c.put(e.request, cl)); } return res; }).catch(() => caches.match(e.request)));
});
// 15/11: avisos (Web Push), de momento solo para las socias. El servidor manda {titulo, texto, url, tag}; al tocar el aviso se abre TuCloset en Hoy
// (si ya estaba abierta, se trae delante y se le dice que vaya a Hoy)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texto: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'TuCloset', { body: d.texto || '', tag: d.tag || 'tucloset', lang: 'es',
    icon: '../../equipo/marca/identidad/kit/icono-129-180.png', data: { url: d.url || './?pantalla=hoy' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = new URL(e.notification.data?.url || './?pantalla=hoy', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ ir: 'hoy' }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
