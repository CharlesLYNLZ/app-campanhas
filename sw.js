// Service worker mínimo: só torna o app instalável no celular.
// Não guarda nada em cache, para você nunca ver dados desatualizados.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
