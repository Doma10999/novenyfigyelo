/**
 * Növényfigyelő – Railway backend
 * Firebase RTDB -> OneSignal Web Push
 */
import http from "http";
import admin from "firebase-admin";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;

function need(name){
  const v = process.env[name];
  if(!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const FIREBASE_PROJECT_ID = need("FIREBASE_PROJECT_ID");
const FIREBASE_CLIENT_EMAIL = need("FIREBASE_CLIENT_EMAIL");
const FIREBASE_PRIVATE_KEY = need("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
const FIREBASE_DB_URL = need("FIREBASE_DB_URL");
const ONESIGNAL_APP_ID = need("ONESIGNAL_APP_ID");
const ONESIGNAL_API_KEY = need("ONESIGNAL_API_KEY");

const THRESHOLD_DEFAULT = Number(process.env.THRESHOLD_DEFAULT || 35);
const COOLDOWN_MINUTES = Number(process.env.COOLDOWN_MINUTES || 180);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY,
  }),
  databaseURL: FIREBASE_DB_URL,
});

const db = admin.database();
const nowMs = () => Date.now();

function pickNumber(obj, keys){
  for(const k of keys){
    const v = obj?.[k];
    if(typeof v === "number") return v;
    if(typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  }
  return null;
}
function pickString(obj, keys){
  for(const k of keys){
    const v = obj?.[k];
    if(typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}
function computeThreshold(device){
  const t = pickNumber(device, ["threshold","minMoisture","minValue"]);
  return (t!=null) ? t : THRESHOLD_DEFAULT;
}

async function sendOneSignalPush({playerId,title,message,url}){
  const body = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: [playerId],
    headings: { en: title },
    contents: { en: message },
  };
  if(url) body.url = url;

  const res = await fetch("https://onesignal.com/api/v1/notifications",{
    method:"POST",
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Authorization":`Basic ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if(!res.ok) throw new Error(`OneSignal ${res.status}: ${text}`);
  return text;
}

function shouldNotify(device){
  const value = pickNumber(device, ["sensorValue","moisture","value","percent"]);
  if(value==null) return {ok:false, reason:"no_value"};
  const threshold = computeThreshold(device);
  const lastPushAt = pickNumber(device, ["lastPushAt","lastNotificationAt"]);
  if(lastPushAt!=null){
    const diffMin = (nowMs()-lastPushAt)/60000;
    if(diffMin < COOLDOWN_MINUTES) return {ok:false, reason:"cooldown", value, threshold};
  }
  if(value <= threshold) return {ok:true, value, threshold};
  return {ok:false, reason:"above_threshold", value, threshold};
}

async function runCheck(){
  const snap = await db.ref("users").get();
  const users = snap.exists() ? snap.val() : {};
  const results = {scanned:0, notified:0, errors:0, details:[]};

  for(const uid of Object.keys(users||{})){
    const devices = users?.[uid]?.devices || {};
    for(const deviceId of Object.keys(devices||{})){
      results.scanned++;
      const device = devices[deviceId] || {};
      const webpush = device.webpush || {};
      const enabled = !!webpush.enabled;
      const playerId = pickString(webpush, ["playerId","playerID","subscriptionId","subId","onesignalPlayerId"]);
      if(!enabled || !playerId) continue;

      const dec = shouldNotify(device);
      if(!dec.ok) continue;

      try{
        const title="Növényfigyelő";
        const message=`Figyelem! A talajnedvesség ${dec.value}% (küszöb: ${dec.threshold}%). Ideje locsolni.`;
        const url = pickString(device, ["dashboardUrl","url"]);
        await sendOneSignalPush({playerId, title, message, url});
        await db.ref(`users/${uid}/devices/${deviceId}/lastPushAt`).set(nowMs());
        results.notified++;
        results.details.push({uid, deviceId, sent:true, value:dec.value, threshold:dec.threshold});
      }catch(e){
        results.errors++;
        results.details.push({uid, deviceId, sent:false, error:String(e)});
      }
    }
  }
  return results;
}

function sendJson(res, code, obj){
  res.writeHead(code,{
    "Content-Type":"application/json; charset=utf-8",
    "Access-Control-Allow-Origin":"*",
  });
  res.end(JSON.stringify(obj,null,2));
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);

  if(req.method==="GET" && url.pathname==="/health"){
    return sendJson(res,200,{ok:true, service:"novenyfigyelo-backend", time:new Date().toISOString()});
  }
  if(req.method==="GET" && url.pathname==="/run-check"){
    try{
      const out = await runCheck();
      return sendJson(res,200,{ok:true, ...out});
    }catch(e){
      return sendJson(res,500,{ok:false, error:String(e)});
    }
  }
  if(req.method==="OPTIONS"){
    res.writeHead(204,{
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type,Authorization",
    });
    return res.end();
  }
  return sendJson(res,404,{ok:false, error:"Not found"});
});

server.listen(PORT, ()=> console.log(`Backend listening on port ${PORT}`));
