(() => {
  "use strict";

  const WORKER_BASE = "https://novenyfigyelo-push.drobnidominik.workers.dev";
  const UI_ID = "webPushSettingsBox";
  const ENABLE_ID = "webPushEnableBtn";
  const DISABLE_ID = "webPushDisableBtn";
  const STATUS_ID = "webPushStatusText";

  let refreshBusy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isIOS() {
    return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function detectPlatform() {
    if (isIOS()) return isStandalone() ? "ios-pwa" : "ios-browser";
    if (/Android/i.test(navigator.userAgent)) return "android-web";
    return "web";
  }

  function pushSupported() {
    return "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
  }

  function injectStyle() {
    if (document.getElementById("webPushInlineStyle")) return;

    const style = document.createElement("style");
    style.id = "webPushInlineStyle";
    style.textContent = `
      #${UI_ID}{margin-top:18px;padding:14px;border:1px solid rgba(40,120,75,.16);border-radius:16px;background:rgba(244,252,247,.9);text-align:left}
      #${UI_ID} .push-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
      #${UI_ID} .push-icon{width:34px;height:34px;border-radius:12px;background:#e9f7ee;display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto}
      #${UI_ID} .push-title{font-weight:800;color:#183d2b;line-height:1.15}
      #${UI_ID} .push-sub{font-size:12px;opacity:.67;margin-top:2px}
      #${STATUS_ID}{font-size:13px;line-height:1.35;margin:9px 0 10px;color:#52645b}
      #${STATUS_ID}.ok{color:#1f7a43}
      #${STATUS_ID}.warn{color:#9a6a10}
      #${STATUS_ID}.error{color:#c62828}
      #${UI_ID} .push-actions{display:flex;gap:8px;flex-wrap:wrap}
      #${UI_ID} button{width:auto;border:0;border-radius:11px;padding:9px 13px;font-weight:800;cursor:pointer}
      #${ENABLE_ID}{background:linear-gradient(145deg,#1f9d61,#37b86f);color:white}
      #${DISABLE_ID}{background:#e7eeeb;color:#46534d}
      #${UI_ID} button:disabled{opacity:.55;cursor:not-allowed}
      #${UI_ID} .push-help{font-size:11px;opacity:.58;margin-top:9px}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    const modalContent = document.getElementById("notifModalContent");
    if (!modalContent) return null;

    injectStyle();

    let box = document.getElementById(UI_ID);
    if (box) return box;

    box = document.createElement("div");
    box.id = UI_ID;
    box.innerHTML = `
      <div class="push-head">
        <div class="push-icon">🔔</div>
        <div>
          <div class="push-title">Push értesítések</div>
          <div class="push-sub">Plus csomaghoz</div>
        </div>
      </div>
      <div id="${STATUS_ID}">Állapot ellenőrzése…</div>
      <div class="push-actions">
        <button id="${ENABLE_ID}" type="button" style="display:none">Push bekapcsolása</button>
        <button id="${DISABLE_ID}" type="button" style="display:none">Push kikapcsolása</button>
      </div>
      <div class="push-help">Az értesítést mindig azon a telefonon vagy böngészőben kapod meg, ahol bekapcsolod.</div>
    `;

    const saveBtn = document.getElementById("notifSave");
    const actionRow = saveBtn?.parentElement;
    if (actionRow?.parentElement === modalContent) {
      modalContent.insertBefore(box, actionRow);
    } else {
      modalContent.appendChild(box);
    }

    document.getElementById(ENABLE_ID)?.addEventListener("click", enablePush);
    document.getElementById(DISABLE_ID)?.addEventListener("click", disablePush);

    return box;
  }

  function setStatus(text, tone = "") {
    ensureUI();
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = text;
    el.className = tone;
  }

  function setButtons({ enable = false, disable = false, busy = false } = {}) {
    ensureUI();
    const enableBtn = document.getElementById(ENABLE_ID);
    const disableBtn = document.getElementById(DISABLE_ID);

    if (enableBtn) {
      enableBtn.style.display = enable ? "inline-block" : "none";
      enableBtn.disabled = busy;
      enableBtn.textContent = busy && enable ? "Bekapcsolás…" : "Push bekapcsolása";
    }

    if (disableBtn) {
      disableBtn.style.display = disable ? "inline-block" : "none";
      disableBtn.disabled = busy;
      disableBtn.textContent = busy && disable ? "Kikapcsolás…" : "Push kikapcsolása";
    }
  }

  async function getCurrentUser(waitMs = 2500) {
    const started = Date.now();
    while (Date.now() - started < waitMs) {
      const user = window.__auth?.currentUser || null;
      if (user) return user;
      await sleep(80);
    }
    return window.__auth?.currentUser || null;
  }

  async function getToken(forceRefresh = false) {
    const user = await getCurrentUser();
    if (!user) throw new Error("not_logged_in");
    return user.getIdToken(forceRefresh);
  }

  async function api(path, options = {}, retryAuth = true) {
    const headers = new Headers(options.headers || {});
    const needsAuth = path !== "/vapid-public-key" && path !== "/health";

    if (needsAuth) {
      const token = await getToken(false);
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${WORKER_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });

    if (response.status === 401 && needsAuth && retryAuth) {
      const token = await getToken(true);
      headers.set("Authorization", `Bearer ${token}`);
      return apiWithHeaders(path, options, headers);
    }

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const error = new Error(data.error || data.message || `HTTP_${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async function apiWithHeaders(path, options, headers) {
    const response = await fetch(`${WORKER_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const error = new Error(data.error || data.message || `HTTP_${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async function getRegistration() {
    if (!("serviceWorker" in navigator)) return null;

    let registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    }

    await navigator.serviceWorker.ready;
    return registration;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  function plusError(error) {
    return error?.status === 403 && [
      "plus_subscription_required",
      "subscription_access_denied"
    ].includes(String(error?.message || ""));
  }

  async function refreshPushState() {
    if (refreshBusy) return;
    refreshBusy = true;
    ensureUI();
    setButtons({});

    try {
      const user = await getCurrentUser(800);
      if (!user) {
        setStatus("A push beállításához előbb jelentkezz be.", "warn");
        return;
      }

      let serverState;
      try {
        serverState = await api("/subscription-status", { method: "GET" });
      } catch (error) {
        if (plusError(error)) {
          setStatus("A push értesítés Plus csomagban érhető el.", "warn");
          return;
        }
        throw error;
      }

      if (serverState.activePlus === false || serverState.available === false) {
        setStatus("A push értesítés Plus csomagban érhető el.", "warn");
        return;
      }

      if (!pushSupported()) {
        if (isIOS() && !isStandalone()) {
          setStatus("iPhone/iPad készüléken add a Növényfigyelőt a Főképernyőhöz, majd onnan nyisd meg a push bekapcsolásához.", "warn");
        } else {
          setStatus("Ez a böngésző nem támogatja a Web Push értesítéseket.", "warn");
        }
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("Az értesítések le vannak tiltva ennél a webhelynél. A böngésző webhely-beállításaiban engedélyezd őket.", "error");
        return;
      }

      const registration = await getRegistration();
      const localSubscription = await registration?.pushManager.getSubscription();

      if (localSubscription) {
        setStatus("Push bekapcsolva ezen az eszközön.", "ok");
        setButtons({ disable: true });
      } else {
        const otherCount = Number(serverState.subscriptions || 0);
        setStatus(
          otherCount > 0
            ? `Ezen az eszközön még nincs bekapcsolva. Más eszközön ${otherCount} aktív feliratkozás van.`
            : "A push értesítés még nincs bekapcsolva ezen az eszközön.",
          ""
        );
        setButtons({ enable: true });
      }
    } catch (error) {
      console.warn("Push állapot ellenőrzési hiba:", error);
      const msg = String(error?.message || "");
      if (msg === "not_logged_in") {
        setStatus("A push beállításához előbb jelentkezz be.", "warn");
      } else {
        setStatus("A push állapotát most nem sikerült ellenőrizni. Próbáld újra.", "error");
        if (pushSupported()) setButtons({ enable: true });
      }
    } finally {
      refreshBusy = false;
    }
  }

  async function enablePush() {
    ensureUI();
    setButtons({ enable: true, busy: true });

    let newlyCreatedSubscription = null;

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("not_logged_in");

      // A szerver mondja meg, hogy a fiók valóban aktív Plus-e.
      const state = await api("/subscription-status", { method: "GET" });
      if (state.activePlus === false || state.available === false) {
        setStatus("A push értesítés Plus csomagban érhető el.", "warn");
        setButtons({});
        return;
      }

      if (!pushSupported()) {
        setStatus("Ez a böngésző nem támogatja a Web Push értesítéseket.", "warn");
        setButtons({});
        return;
      }

      if (isIOS() && !isStandalone()) {
        setStatus("iPhone/iPad készüléken előbb add a weboldalt a Főképernyőhöz, és onnan nyisd meg.", "warn");
        setButtons({});
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setStatus("Az értesítési engedély nincs megadva.", "warn");
        setButtons({ enable: true });
        return;
      }

      const registration = await getRegistration();
      if (!registration) throw new Error("service_worker_unavailable");

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapid = await api("/vapid-public-key", { method: "GET" });
        if (!vapid.publicKey) throw new Error("missing_vapid_public_key");

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
        });
        newlyCreatedSubscription = subscription;
      }

      await api("/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          platform: detectPlatform()
        })
      });

      setStatus("Push bekapcsolva ezen az eszközön.", "ok");
      setButtons({ disable: true });
    } catch (error) {
      console.error("Push bekapcsolási hiba:", error);

      if (newlyCreatedSubscription) {
        try { await newlyCreatedSubscription.unsubscribe(); } catch {}
      }

      if (plusError(error)) {
        setStatus("A push értesítés Plus csomagban érhető el.", "warn");
        setButtons({});
      } else if (String(error?.message || "") === "not_logged_in") {
        setStatus("A push beállításához előbb jelentkezz be.", "warn");
        setButtons({});
      } else {
        setStatus("A push bekapcsolása nem sikerült. Próbáld újra.", "error");
        setButtons({ enable: true });
      }
    }
  }

  async function disablePush() {
    ensureUI();
    setButtons({ disable: true, busy: true });

    try {
      const registration = await getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        try {
          await api("/unsubscribe", {
            method: "POST",
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        } finally {
          await subscription.unsubscribe();
        }
      }

      setStatus("Push kikapcsolva ezen az eszközön.", "");
      setButtons({ enable: true });
    } catch (error) {
      console.error("Push kikapcsolási hiba:", error);
      setStatus("A push kikapcsolása nem sikerült. Próbáld újra.", "error");
      setButtons({ disable: true });
    }
  }

  function attachEvents() {
    ensureUI();

    document.getElementById("notifBellBtn")?.addEventListener("click", () => {
      setTimeout(refreshPushState, 80);
    });

    window.addEventListener("subscription-plan-updated", () => {
      setTimeout(refreshPushState, 100);
    });

    window.addEventListener("novenyfigyelo-service-worker-ready", () => {
      setTimeout(refreshPushState, 100);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachEvents, { once: true });
  } else {
    attachEvents();
  }

  window.__refreshPushState = refreshPushState;
  window.__enableWebPush = enablePush;
  window.__disableWebPush = disablePush;
})();
