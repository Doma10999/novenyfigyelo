/**
 * Netlify Scheduled Function
 * - 10 percenként lefut (netlify.toml)
 * - Végignézi a Firebase RTDB-t
 * - Ha egy eszközön notifEnabled=true és a kijelzett (kategória szerinti) % < 35,
 *   akkor OneSignal push-t küld CSAK annak az eszköznek (external_user_id = uid|deviceId)
 *
 * Kell a Netlify Environment Variables-ban:
 * - ONESIGNAL_APP_ID
 * - ONESIGNAL_REST_API_KEY
 */
const admin = require("firebase-admin");

let _inited = false;
function initFirebase() {
  if (_inited) return;

  // A projektedben már ott van a serviceAccountKey.json (tudom: nem ideális, de nálad így van)
  // Ha át akarod állítani ENV-re, szólhatsz és átalakítjuk.
  const serviceAccount = require("../../serviceAccountKey.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://plant-monitor-3976f-default-rtdb.europe-west1.firebasedatabase.app"
  });

  _inited = true;
}

function displayPercentFromCategory(realPercent, category) {
  const cats = {
    "🌵Szárazkedvelő": { min: 10, max: 40 },
    "🌾Mérsékelten száraz": { min: 20, max: 45 },
    "🌿Kiegyensúlyozott vízigényű": { min: 30, max: 60 },
    "🌱Nedvességkedvelő": { min: 50, max: 80 },
    "💧Vízigényes": { min: 70, max: 100 }
  };

  if (!cats[category]) return clamp(realPercent, 0, 100);

  const { min, max } = cats[category];
  const d = Math.round(((realPercent - min) / (max - min)) * 100);
  return clamp(d, 0, 100);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

async function sendOneSignal({ externalUserId, title, message }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.log("⚠️ Hiányzó OneSignal env var: ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY");
    return { ok: false, reason: "missing_env" };
  }

  const body = {
    app_id: appId,
    include_external_user_ids: [externalUserId],
    headings: { en: title },
    contents: { en: message },
    // web push ikon / url opcionális:
    // url: "https://novenyfigyelo.netlify.app"
  };

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Basic ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log("❌ OneSignal error:", res.status, data);
    return { ok: false, status: res.status, data };
  }
  return { ok: true, data };
}

exports.handler = async () => {
  try {
    initFirebase();

    const THRESHOLD = 35;             // kijelzett % alatti értesítés
    const COOLDOWN_MIN = 360;         // 6 óra: ne spammeljünk
    const now = Date.now();

    const usersSnap = await admin.database().ref("users").once("value");
    if (!usersSnap.exists()) {
      console.log("Nincs users adat.");
      return { statusCode: 200, body: "OK (no users)" };
    }

    const users = usersSnap.val() || {};
    let sent = 0;

    for (const [uid, userObj] of Object.entries(users)) {
      const devices = (userObj && userObj.devices) ? userObj.devices : {};
      for (const [deviceId, dev] of Object.entries(devices || {})) {
        const notifEnabled = !!dev.notifEnabled;
        if (!notifEnabled) continue;

        const real = Number(dev.sensorValue);
        if (!Number.isFinite(real)) continue;

        const cat = String(dev.plantType || "");
        const display = displayPercentFromCategory(real, cat);

        // csak ha alatta van
        if (display >= THRESHOLD) continue;

        const lastPushAt = Number(dev.lastPushAt || 0);
        if (lastPushAt && (now - lastPushAt) < COOLDOWN_MIN * 60 * 1000) continue;

        const name = (dev.displayName && String(dev.displayName).trim()) ? String(dev.displayName).trim() : deviceId;
        const title = "Növényfigyelő – alacsony vízszint";
        const msg = `${name}: ${display}% (valós: ${real}%)`;

        const externalUserId = `${uid}|${deviceId}`;
        const r = await sendOneSignal({ externalUserId, title, message: msg });
        if (r.ok) {
          sent++;
          await admin.database().ref(`users/${uid}/devices/${deviceId}/lastPushAt`).set(now);
          await admin.database().ref(`users/${uid}/devices/${deviceId}/lastPushValue`).set(display);
        }
      }
    }

    console.log("✅ Push sent:", sent);
    return { statusCode: 200, body: `OK sent=${sent}` };

  } catch (e) {
    console.log("❌ sendPush crash:", e);
    return { statusCode: 500, body: "ERROR" };
  }
};
