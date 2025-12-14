const { getDb, initWebPush, webpush } = require("./pushCommon");

const plantCategories = {
  "🌵Szárazkedvelő": { min: 10, max: 40 },
  "🌾Mérsékelten száraz": { min: 20, max: 45 },
  "🌿Kiegyensúlyozott vízigényű": { min: 30, max: 60 },
  "🌱Nedvességkedvelő": { min: 50, max: 80 },
  "💧Vízigényes": { min: 70, max: 100 },
};

function mapToCategoryPercent(sensorValue, plantType) {
  if (typeof sensorValue !== "number") return null;
  const cat = plantCategories[plantType];
  if (!cat) return sensorValue;

  const { min, max } = cat;
  const pct = Math.round(((sensorValue - min) / (max - min)) * 100);
  return Math.max(0, Math.min(100, pct));
}

exports.handler = async () => {
  try {
    const db = getDb();
    initWebPush();

    const subsSnap = await db.ref("/pushSubscriptions").once("value");
    const subsAll = subsSnap.val() || {};

    if (!Object.keys(subsAll).length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Nincs feliratkozó." }),
      };
    }

    const usersSnap = await db.ref("/users").once("value");
    const users = usersSnap.val() || {};

    const notifications = [];

    for (const [uid, userData] of Object.entries(users)) {
      const devices = (userData && userData.devices) || {};
      const userSubs = subsAll[uid] || {};
      if (!Object.keys(userSubs).length) continue;

      for (const [deviceId, dev] of Object.entries(devices)) {
        if (!dev) continue;

        const rawVal = typeof dev.sensorValue === "number" ? dev.sensorValue : null;
        if (rawVal === null) continue;

        const plantType = dev.plantType || null;
        const displayPct = mapToCategoryPercent(rawVal, plantType);
        if (displayPct === null) continue;

        if (displayPct <= 35) {
          const sub = userSubs[deviceId];
          if (!sub) continue;

          const name = dev.displayName || deviceId;
          notifications.push({ uid, deviceId, sub, displayPct, name });
        }
      }
    }

    if (!notifications.length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Nincs 35% alatti növény (kategória alapján)." }),
      };
    }

    const results = [];
    for (const n of notifications) {
      const payload = JSON.stringify({
        title: "Növényfigyelő",
        body: `${n.name}: ${n.displayPct}% alá esett a vízszint!`,
      });

      try {
        await webpush.sendNotification(n.sub, payload);
        results.push({ uid: n.uid, deviceId: n.deviceId, ok: true });
      } catch (err) {
        console.error("Webpush hiba", n.uid, n.deviceId, err && err.body ? err.body : err);
        results.push({ uid: n.uid, deviceId: n.deviceId, ok: false });
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sent: results }),
    };
  } catch (err) {
    console.error("sendPush error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
