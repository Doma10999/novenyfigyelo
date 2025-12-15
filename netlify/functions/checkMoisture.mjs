import admin from "firebase-admin";

const plantCategories = {
  "🌵Szárazkedvelő": { min: 10, max: 40 },
  "🌾Mérsékelten száraz": { min: 20, max: 45 },
  "🌿Kiegyensúlyozott vízigényű": { min: 30, max: 60 },
  "🌱Nedvességkedvelő": { min: 50, max: 80 },
  "💧Vízigényes": { min: 70, max: 100 },
};

function calcDisplayPercent(realPercent, cat) {
  const cfg = plantCategories[cat];
  if (!cfg) return Math.round(realPercent);
  const { min, max } = cfg;
  let display = Math.round(((realPercent - min) / (max - min)) * 100);
  if (display < 0) display = 0;
  if (display > 100) display = 100;
  return display;
}

let _inited = false;
function initFirebase() {
  if (_inited) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const dbUrl = process.env.FIREBASE_DATABASE_URL;
  if (!svc || !dbUrl) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_DATABASE_URL env var.");
  }
  const cert = JSON.parse(svc);
  admin.initializeApp({
    credential: admin.credential.cert(cert),
    databaseURL: dbUrl,
  });
  _inited = true;
}

async function sendPush({ deviceId, title, message, url }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) throw new Error("Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY env var.");

  const body = {
    app_id: appId,
    target_channel: "push",
    headings: { hu: title, en: title },
    contents: { hu: message, en: message },
    // célzás a deviceId tag alapján (amit az index.html beállít)
    filters: [{ field: "tag", key: "deviceId", relation: "=", value: String(deviceId) }],
    // web_url: kattintásra nyíljon meg a dashboard
    web_url: url || undefined,
    isAnyWeb: true,
  };

  const res = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${restKey}`,
    },
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`OneSignal push failed ${res.status}: ${txt}`);
  }
  return txt;
}

export default async (req) => {
  try {
    initFirebase();

    const thresholdDefault = 35;
    const cooldownDefault = 6 * 60 * 60 * 1000; // 6 óra

    const snap = await admin.database().ref("users").once("value");
    const users = snap.val() || {};
    const now = Date.now();

    let checked = 0;
    let sent = 0;

    for (const [uid, u] of Object.entries(users)) {
      const devices = (u && u.devices) ? u.devices : {};
      for (const [deviceId, d] of Object.entries(devices)) {
        checked++;

        if (!d || d.notifEnabled !== true) continue;

        const real = Number(d.sensorValue);
        if (!Number.isFinite(real)) continue;

        const cat = d.plantType || null;
        const display = calcDisplayPercent(real, cat);

        const threshold = Number(d.notifDisplayThreshold);
        const limit = Number.isFinite(threshold) ? threshold : thresholdDefault;

        if (display >= limit) continue;

        const cooldown = Number(d.notifCooldownMs);
        const cd = Number.isFinite(cooldown) ? cooldown : cooldownDefault;

        const last = Number(d.notifLastSentAt || 0);
        if (now - last < cd) continue;

        // küldés
        const title = "Növényfigyelő – öntözés";
        const msg = `A(z) ${d.displayName || deviceId} vízszintje alacsony (${display}%).`;

        const siteUrl = process.env.SITE_URL || "";
        const dashUrl = siteUrl ? `${siteUrl}/` : undefined;

        await sendPush({ deviceId, title, message: msg, url: dashUrl });
        sent++;

        // mentjük, hogy ne spammeljen
        await admin.database().ref(`users/${uid}/devices/${deviceId}/notifLastSentAt`).set(now);
      }
    }

    console.log(JSON.stringify({ ok: true, checked, sent }));
    return new Response(JSON.stringify({ ok: true, checked, sent }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
};

export const config = {
  // 15 percenként (UTC)
  schedule: "*/15 * * * *",
};
