// Service Worker para Pulso Taller PWA - Soporte de Shell y Modo Offline
const CACHE_NAME = "pulso-taller-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // No interceptar llamadas al backend de Convex, WebSockets, ni mutaciones POST
  if (
    url.pathname.startsWith("/api") ||
    url.hostname.includes("convex") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // Network-first con fallback al cache local del dispositivo
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
        }
        return new Response("Sin conexión a la red.", {
          status: 503,
          statusText: "Service Unavailable (Offline)",
          headers: new Headers({ "Content-Type": "text/plain; charset=utf-8" }),
        });
      })
  );
});
