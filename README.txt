Növényfigyelő – OneSignal Push (fix)

MIT CSINÁL EZ A VERZIÓ?
- A régi VAPID / web-push + /.netlify/functions/registerPush részt teljesen kiváltja OneSignal-lal.
- Minden eszköz külön "external user id"-t kap:  uid|deviceId
- A push csak annak az eszköznek megy, amelyikre feliratkoztál (kijelölt kártya + Igen).
- Netlify Scheduled Function 10 percenként ellenőrzi a Firebase RTDB-t és küld értesítést, ha:
  - notifEnabled = true
  - és a KIJELZETT % (kategória szerinti) < 35
  - és az utolsó push óta eltelt legalább 6 óra (cooldown)

FONTOS: 2 db ENV VAR KELL NETLIFY-BAN
Site settings → Environment variables:
- ONESIGNAL_APP_ID        = 6a595cdc-e443-4179-bc11-95241c8ad20f
- ONESIGNAL_REST_API_KEY  = (OneSignal → Settings → Keys & IDs → REST API Key)

FÁJLOK A GYÖKÉRBE (root)
- OneSignalSDKWorker.js
- OneSignalSDKUpdaterWorker.js
Ezek már benne vannak a projektben.

HOGYAN HASZNÁLD
1) Feltöltöd GitHub-ra (a ZIP tartalmát a repo gyökerébe).
2) Netlify új deploy.
3) Netlify-ban beállítod az ENV VAR-okat (fent).
4) Megnyitod az oldalt → belépés → kattints a megfelelő kártyára (kijelölés) → Harang → Igen.
   Ezzel:
   - users/{uid}/devices/{deviceId}/notifEnabled = true
   - OneSignal login = uid|deviceId

MEGJEGYZÉS
- A serviceAccountKey.json a repo-ban NEM biztonságos (publikus). Most azért hagytam bent,
  mert te is így küldted és most a cél: működjön 100%-ra.
  Ha akarod, átalakítom úgy, hogy Netlify ENV-ből menjen és ne legyen kint a GitHub-on.
