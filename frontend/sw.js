self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Növényfigyelő", body: event.data.text() };
    }
  }

  const title = data.title || "Növényfigyelő";
  const options = {
    body: data.body || "Új értesítés érkezett a növényedről.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
