import express from "express";
import admin from "firebase-admin";

const app = express();
app.use(express.json());

// ===== Required ENV (Railway Variables) =====
// Firebase Admin
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY; // keep \n as \\n in Railway
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

// OneSignal
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY; // OneSignal REST API Key

function must(v, name){
  if(!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let db = null;
try{
  must(FIREBASE_PROJECT_ID,"FIREBASE_PROJECT_ID");
  must(FIREBASE_CLIENT_EMAIL,"FIREBASE_CLIENT_EMAIL");
  must(FIREBASE_PRIVATE_KEY,"FIREBASE_PRIVATE_KEY");
  must(FIREBASE_DB_URL,"FIREBASE_DB_URL");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: FIREBASE_DB_URL
  });

  db = admin.database();
  console.log("Firebase Admin initialized.");
}catch(e){
  console.error("Firebase init error:", e.message);
}

async function sendOneSignalToSubscription(subscriptionId, title, body){
  must(ONESIGNAL_APP_ID,"ONESIGNAL_APP_ID");
  must(ONESIGNAL_API_KEY,"ONESIGNAL_API_KEY");
  if(!subscriptionId) return;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_subscription_ids: [subscriptionId],
    target_channel: "push",
    headings: { en: title, hu: title },
    contents: { en: body, hu: body }
  };

  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(()=> ({}));
  if(!res.ok){
    console.error("OneSignal error:", res.status, data);
    throw new Error("OneSignal API error");
  }
  return data;
}

// ===== Core check =====
// DB layout (as in your index.html):
// users/{uid}/devices/{deviceId}/sensorValue   -> percent (0..100)
// users/{uid}/devices/{deviceId}/displayName   -> name
// users/{uid}/devices/{deviceId}/plantType     -> category name (optional)
// users/{uid}/devices/{deviceId}/webpush       -> { enabled, thresholdPercent, subscriptionId }
async function runCheck(){
  if(!db) throw new Error("Firebase not initialized.");

  const usersSnap = await db.ref("users").once("value");
  const users = usersSnap.val() || {};
  let notified = 0;

  for(const uid of Object.keys(users)){
    const u = users[uid] || {};
    const devices = u.devices || {};
    for(const deviceId of Object.keys(devices)){
      const d = devices[deviceId] || {};
      const moisture = Number(d.sensorValue);
      if(!Number.isFinite(moisture)) continue;

      const webpush = d.webpush || null;
      if(!webpush || !webpush.enabled) continue;

      const threshold = Number(webpush.thresholdPercent ?? 35);
      const subId = webpush.subscriptionId;

      if(Number.isFinite(threshold) && moisture <= threshold && subId){
        const name = d.displayName || "növényed";
        await sendOneSignalToSubscription(
          subId,
          "Növényfigyelő – locsolási emlékeztető",
          `A(z) ${name} vízszintje ${moisture}% (küszöb: ${threshold}%). Ideje meglocsolni!`
        );
        notified++;
      }
    }
  }
  return {notified};
}

// Manual trigger (for testing)
app.get("/run-check", async (req,res)=>{
  try{
    const out = await runCheck();
    res.json({ok:true, ...out});
  }catch(e){
    res.status(500).json({ok:false, error:e.message});
  }
});

app.get("/", (req,res)=> res.send("Növényfigyelő OneSignal backend fut."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log("Listening on", PORT));
