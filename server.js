import express from "express";
import webpush from "web-push";
import pg from "pg";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();  // Railway-en ez nem kellene, de bajt nem okoz

const app = express();
app.use(cors());
app.use(express.json());

// DATABASE
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// WEBPUSH CONFIG
webpush.setVapidDetails(
  "mailto:test@test.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// SUBSCRIBER MENTÉSE
app.post("/subscribe", async (req, res) => {
  const subscription = req.body;

  try {
    await pool.query(
      "INSERT INTO subscriptions (subscription) VALUES ($1)",
      [subscription]
    );
    res.status(201).json({ message: "Subscription saved" });
  } catch (err) {
    console.error("DB Save error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// TESZT PUSH
app.post("/send", async (req, res) => {
  try {
    const result = await pool.query("SELECT subscription FROM subscriptions");

    result.rows.forEach(row => {
      const sub = row.subscription;
      webpush.sendNotification(sub, JSON.stringify({ title: "Teszt push!" }));
    });

    res.json({ message: "Push sent" });
  } catch (err) {
    console.error("Push error:", err);
    res.status(500).json({ error: "Push error" });
  }
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
