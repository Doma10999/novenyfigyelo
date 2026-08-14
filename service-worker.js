"use strict";

const CACHE_NAME = "novenyfigyelo-cache-push-v20260814";
const OFFLINE_URL = "/offline.html";
const APP_URL = "/";
const DEFAULT_ICON = "/icon2.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/",
        "/index.html",
        "/offline.html",
        DEFAULT_ICON
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

// Offline fallback csak oldalnavigációnál.
// API-, Firebase- és Cloudflare-kérést nem cserélünk offline.html-re.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Növényfigyelő";
  const options = {
    body: data.body || data.message || "Új értesítés érkezett.",
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: data.tag || "novenyfigyelo",
    timestamp: Number(data.timestamp || Date.now()),
    renotify: true,
    data: {
      url: data.url || APP_URL,
      type: data.type || "general"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || APP_URL;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const absoluteTarget = new URL(targetUrl, self.location.origin);

      for (const client of clients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin !== absoluteTarget.origin) continue;

          if ("navigate" in client && client.url !== absoluteTarget.href) {
            await client.navigate(absoluteTarget.href);
          }

          if ("focus" in client) return client.focus();
        } catch {
          // Következő ablak.
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTarget.href);
      }

      return undefined;
    })
  );
});
