# Növényfigyelő – Netlify + Firebase + OneSignal (ingyenes)
## Mit kapsz ebben a ZIP-ben?
- index.html (a te oldalad, OneSignal-re átállított push)
- OneSignalSDKWorker.js (kötelező, a site gyökerében)
- Netlify Scheduled Function: netlify/functions/checkMoisture.mjs (15 percenként ellenőrzi a vízszintet és küld push-t)
- netlify.toml + package.json

## Mit kell még beállítanod a Netlify UI-ban?
Environment variables:
- ONESIGNAL_APP_ID = (OneSignal Dashboard -> Settings -> Keys & IDs -> App ID)
- ONESIGNAL_REST_API_KEY = (OneSignal Dashboard -> Settings -> Keys & IDs -> REST API Key)
- FIREBASE_DATABASE_URL = https://<PROJECT>.firebaseio.com
- FIREBASE_SERVICE_ACCOUNT_JSON = a Firebase service account JSON *egysoros* (string) formában
- SITE_URL = a Netlify domain-ed (pl. https://novenyfigyelo.netlify.app)

A scheduled function csak Published deployon fut.
