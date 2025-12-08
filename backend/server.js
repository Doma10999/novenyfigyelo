import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webPush from "web-push";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

// ---- ENV VÁLTOZÓK ----
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!DATABASE_URL) {
  console.error("Hiányzik a DATABASE_URL env változó!");
  process.exit(1);
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Hiányzik a VAPID_PUBLIC_KEY vagy VAPID_PRIVATE_KEY env változó!");
  process.exit(1);
}

// Web Push (VAPID) beállítás
webPush.setVapidDetails(
  "mailto:example@example.com", // ide tehetsz saját emailt is
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// PostgreSQL pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();
app.use(cors());
app.use(express.json());

// ---- SEGÉD: adatbázis inicializálás ----
async function initDb() {
  // subscriptions tábla: melyik user / device kér értesítést
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      device_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL
    );
  `);

  // measurements tábla: az ESP által küldött adatok
  await pool.query(`
    CREATE TABLE IF NOT EXISTS measurements (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      moisture NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("Adatbázis táblák ellenőrizve / létrehozva.");
}

// ---- API: Subscribe (harang ikon) ----
app.post("/api/subscribe", async (req, res) => {
  try {
    const { userId, deviceId, subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Hiányos subscription adatok." });
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys.p256dh;
    const auth = subscription.keys.auth;

    await pool.query(
      `
      INSERT INTO subscriptions (user_id, device_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (endpoint) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          device_id = EXCLUDED.device_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth;
      `,
      [userId || null, deviceId || null, endpoint, p256dh, auth]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Hiba /api/subscribe:", err);
    return res.status(500).json({ error: "Szerver hiba /api/subscribe" });
  }
});

// ---- API: Measurement az ESP-től ----
app.post("/api/measurement", async (req, res) => {
  try {
    const { deviceId, moisture } = req.body;

    if (!deviceId || typeof moisture === "undefined") {
      return res.status(400).json({ error: "Hiányzik deviceId vagy moisture." });
    }

    const moistureNum = Number(moisture);

    // Mentés az adatbázisba
    await pool.query(
      `
      INSERT INTO measurements (device_id, moisture)
      VALUES ($1, $2);
      `,
      [deviceId, moistureNum]
    );

    // Ha 35% alatt van, küldünk push-t azoknak, akik erre az eszközre feliratkoztak
    if (moistureNum <= 35) {
      const { rows: subs } = await pool.query(
        `
        SELECT endpoint, p256dh, auth
        FROM subscriptions
        WHERE device_id = $1;
        `,
        [deviceId]
      );

      console.log(`Alacsony nedvesség (${moistureNum}%) - ${subs.length} feliratkozónak küldünk push-t.`);

      const notificationPayload = JSON.stringify({
        title: "Növényfigyelő",
        body: `Figyelem! A(z) ${deviceId} növény nedvessége ${moistureNum}% alá esett.`,
        icon: "/icon-192.png"
      });

      for (const sub of subs) {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        webPush
          .sendNotification(pushSub, notificationPayload)
          .catch((err) => {
            console.error("Push küldési hiba egy feliratkozónál:", err.statusCode || err);
          });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Hiba /api/measurement:", err);
    return res.status(500).json({ error: "Szerver hiba /api/measurement" });
  }
});

// ---- API: Legutóbbi mérés lekérése (ha később kellene) ----
app.get("/api/latest", async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: "Hiányzik deviceId query paraméter." });
    }

    const { rows } = await pool.query(
      `
      SELECT moisture, created_at
      FROM measurements
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [deviceId]
    );

    if (rows.length === 0) {
      return res.json({ moisture: null, createdAt: null });
    }

    return res.json({
      moisture: Number(rows[0].moisture),
      createdAt: rows[0].created_at,
    });
  } catch (err) {
    console.error("Hiba /api/latest:", err);
    return res.status(500).json({ error: "Szerver hiba /api/latest" });
  }
});

// ---- Indítás ----
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Szerver fut a ${PORT} porton`);
    });
  })
  .catch((err) => {
    console.error("Nem sikerült az adatbázist inicializálni:", err);
    process.exit(1);
  });
