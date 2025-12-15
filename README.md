# Növényfigyelő – OneSignal Web Push + Railway backend (ingyen)

## Mit csináltam?
- Az **index.html kinézetét és működését meghagytam**, csak a push részt javítottam.
- Kivettem a **VAPID + sw.js** (saját webpush) részt, mert az ütközött a OneSignal-lal.
- A harang modal **Igen/Nem** gombja most:
  - OneSignal engedélykérés + feliratkozás
  - a kiválasztott eszközre elmenti a beállítást a Firebase-be:
    `users/{uid}/devices/{deviceId}/webpush`

## 1) OneSignal beállítás
1. OneSignalban hozz létre egy Web Push appot.
2. Add hozzá a weboldal URL-t (Netlify).
3. Jegyezd fel:
   - OneSignal **App ID**
   - OneSignal **REST API Key**

Az index.html-ben már benne van az App ID (a te jelenlegi értékeddel). Ha változik, cseréld.

## 2) Netlify (frontend)
- Töltsd fel a repo-t GitHubra.
- Netlify: new site from GitHub.
- Gyökérben legyen:
  - index.html
  - OneSignalSDKWorker.js
  - netlify.toml

## 3) Railway (backend)
Deploy a `backend/` mappát Railway-re.

### Railway Variables (kötelező)
Firebase Admin:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY   (a sortöréseket \n formában add meg)
- FIREBASE_DB_URL        (Realtime DB URL)

OneSignal:
- ONESIGNAL_APP_ID
- ONESIGNAL_API_KEY

### Cron / Scheduler
Railway-ben állíts be egy cron hívást (pl. 10 percenként):
GET https://<railway-app-url>/run-check

## 4) Használat
1. Jelentkezz be
2. Kattints egy növény kártyára (kijelölés)
3. Harang → Igen
4. Innentől a backend küld push-t, ha `sensorValue <= thresholdPercent`.
