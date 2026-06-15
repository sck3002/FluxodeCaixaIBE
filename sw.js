// ============================================================
// Service Worker - Finanças da Igreja
// IMPORTANTE: sempre que publicar uma nova versão do index.html,
// AUMENTE o número abaixo (v1 -> v2 -> v3...)
// Nunca diminua o número - isso força o app a baixar a versão nova.
// ============================================================
const CACHE_NAME = 'igreja-financas-v3';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear chamadas ao Supabase (banco de dados / autenticação)
  // - sempre precisam ir direto para a rede.
  if (url.hostname.includes('supabase.co')) {
    return;
  }
  if (event.request.method !== 'GET') {
    return;
  }

  // Página principal (HTML/navegação): sempre busca a versão mais nova
  // primeiro na rede. Só usa o cache se estiver sem internet.
  const isHTML = event.request.mode === 'navigate' ||
                 event.request.destination === 'document' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isHTML) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Demais arquivos (ícones, manifest etc.): cache primeiro, com
  // atualização em segundo plano.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
