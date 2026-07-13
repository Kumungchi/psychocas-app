/* Psychočas service worker. Keep personalized and security-sensitive data network-only. */

const CACHE_VERSION = 'psychocas-shell-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/favicon.svg',
  '/faviconV1.png',
  '/faviconV2.png',
  '/apple-touch-icon.png',
  '/icon-maskable-512.png',
  '/brand/psychocas-symbol.svg',
  '/brand/psychocas-wordmark.svg',
];

const NETWORK_ONLY_PREFIXES = [
  '/api/auth',
  '/v',
  '/login',
  '/home',
  '/admin',
  '/workspace',
  '/privacy',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_PRIVATE_CACHES') {
    event.waitUntil(clearPrivateCaches());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNetworkOnly(url.pathname)) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkOnly(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isSafeStaticAsset(request, url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Psychočas', {
      body: payload.body || 'Novinka v členské aplikaci.',
      icon: payload.icon || '/faviconV1.png',
      badge: payload.badge || '/faviconV1.png',
      data: { url: payload.url || '/home' },
      tag: 'psychocas-update',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/home', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

function isNetworkOnly(pathname) {
  return NETWORK_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSafeStaticAsset(request, pathname) {
  return (
    pathname.startsWith('/brand/') ||
    pathname === '/manifest.webmanifest' ||
    request.destination === 'image' ||
    request.destination === 'font'
  );
}

async function networkOnly(request) {
  return fetch(request, { cache: 'no-store' });
}

async function navigationNetworkOnly(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}

async function clearPrivateCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key)));
}
