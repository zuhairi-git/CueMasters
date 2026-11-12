self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || (url.pathname !== scope.pathname && url.pathname !== scope.pathname + 'index.html')) return;

  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cue Master</title><body style="margin:2rem;background:#101e2c;color:#fff2db;font:1rem system-ui"><h1>Cue Master</h1><p>Reconnect to the internet to launch the game.</p><a style="color:#ebcb91" href="">Try again</a></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )));
});
