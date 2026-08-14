"use strict";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        { scope: "/" }
      );

      await registration.update();
      window.__pushServiceWorkerRegistration = registration;
      window.dispatchEvent(new CustomEvent("novenyfigyelo-service-worker-ready"));

      console.log("Növényfigyelő Service Worker OK:", registration.scope);
    } catch (error) {
      console.error("Service Worker hiba:", error);
    }
  });
}
