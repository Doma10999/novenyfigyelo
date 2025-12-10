const express = require("express");
const cors = require("cors");
const webpush = require("web-push");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// --- Environment variables ---
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set.");
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("❌ VAPID keys are not set.");
}

// --- PostgreSQL pool ---
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Ensure table exists
const ensureTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(query);
  console.log("✅ push_subscriptions table ready");
};

ensureTable().catch(err => {
  console.error("❌ Error creating table:", err);
});

// --- Web Push config ---
webpush.setVapidDetails(
  "mailto:doma10999@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);
console.log("✅ Using VAPID public key (first 16 chars):", (VAPID_PUBLIC_KEY || "").slice(0, 16));


// Simple healthcheck
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Novenyfigyelo backend is running." });
});

// Save / update subscription for a user
// Expected body: { userId: "user123", subscription: {...} }
app.post("/subscribe", async (req, res) => {
  const { userId, subscription } = req.body;

  if (!userId || !subscription) {
    return res.status(400).json({ error: "Missing userId or subscription" });
  }

  try {
    // We simply insert; duplicates are fine, user can have multiple devices
    await pool.query(
      "INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2)",
      [userId, subscription]
    );

    return res.status(201).json({ message: "Subscription saved" });
  } catch (err) {
    console.error("❌ Error saving subscription:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// Endpoint for ESP32 / backend logic to trigger low-moisture notifications
// Expected body: { userId: "user123", moisture: 30, threshold: 35, plantName?: "Fikusz" }
app.post("/notify-low-moisture", async (req, res) => {
  const { userId, moisture, threshold = 35, plantName } = req.body;

  if (!userId || typeof moisture !== "number") {
    return res.status(400).json({ error: "Missing userId or moisture" });
  }

  if (moisture >= threshold) {
    return res.json({ message: "Moisture is above threshold, no notification sent." });
  }

  try {
    const result = await pool.query(
      "SELECT subscription FROM push_subscriptions WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      console.log("ℹ️ No subscriptions for user", userId);
      return res.json({ message: "No subscriptions for this user." });
    }

    const title = "Növényfigyelő - Alacsony nedvesség";
    const body = plantName
      ? `A(z) ${plantName} talajnedvessége ${moisture}% alá esett. Öntözés szükséges.`
      : `A növény talajnedvessége ${moisture}% alá esett. Öntözés szükséges.`;

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icon-192.png",
      data: {
        moisture,
        threshold,
        userId,
        plantName: plantName || null
      }
    });

    const sendPromises = result.rows.map(row => {
      return webpush.sendNotification(row.subscription, payload).catch(err => {
        console.error("❌ Error sending push:", err);
      });
    });

    await Promise.all(sendPromises);

    return res.json({ message: "Notifications sent", count: result.rows.length });
  } catch (err) {
    console.error("❌ Error in notify-low-moisture:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
