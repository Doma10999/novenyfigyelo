const admin = require("firebase-admin");
const webpush = require("web-push");

let app;
let dbInstance = null;
let webPushInitialized = false;

function getServiceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  }
  return null;
}

function getDb() {
  if (!dbInstance) {
    if (!app) {
      const svc = getServiceAccountFromEnv() || require("./serviceAccountKey.json");
      app = admin.initializeApp({
        credential: admin.credential.cert(svc),
        databaseURL: "https://plant-monitor-3976f-default-rtdb.europe-west1.firebasedatabase.app",
      });
    }
    dbInstance = admin.database();
  }
  return dbInstance;
}

function initWebPush() {
  if (webPushInitialized) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY || "BJ5EmlT4WDwHo9vyVZbROc4O2tkZlv5hBZVs8nbfEwJlJMdgpgEHnM9i5PugKAXYq10hbPjnvyLOBM-O3hi_Rhg";
  const privateKey = process.env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE || "";

  if (!privateKey) {
    throw new Error("Hiányzik a VAPID_PRIVATE_KEY Netlify környezeti változó!");
  }

  webpush.setVapidDetails("mailto:drobni.dominik@gmail.com", publicKey, privateKey);
  webPushInitialized = true;
}

module.exports = { getDb, initWebPush, webpush };
