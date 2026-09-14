// Service worker: instalável no celular e funciona offline como reserva.
// Estratégia network-first para os arquivos do próprio app (HTML/JS/CSS/
// imagens): busca sempre a versão nova quando há conexão e só usa o
// cache se a rede falhar. Suba este número a cada novo deploy (troque
// também VERSAO em config.js) para os celulares descartarem o cache antigo.
const CACHE_NAME = 'campanhas-v4';

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return; // Supabase, CDN etc. seguem o padrão do navegador

  e.respondWith(
    fetch(req).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copia));
      return resp;
    }).catch(() => caches.match(req))
  );
});
