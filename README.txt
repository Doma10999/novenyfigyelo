# Növényfigyelő – Netlify + Firebase RTDB + Web Push (javított)

## 1) Mappaszerkezet
- index.html
- sw.js
- batteryPercent/  (ide mennek a battery_100.png, battery_75.png, battery_50.png, battery_25.png, battery_0.png)
- netlify/functions/
  - pushCommon.js
  - registerPush.js
  - sendPush.js
- netlify.toml
- package.json

## 2) Képek
A battery ikonokat így tedd fel:
batteryPercent/battery_100.png
batteryPercent/battery_75.png
batteryPercent/battery_50.png
batteryPercent/battery_25.png
batteryPercent/battery_0.png

## 3) Netlify környezeti változók (Site settings → Environment variables)
Kell:
- VAPID_PRIVATE_KEY   = a privát VAPID kulcsod
- VAPID_PUBLIC_KEY    = a publikus VAPID kulcsod (nem kötelező, mert fallback van, de ajánlott)
- FIREBASE_SERVICE_ACCOUNT_BASE64  = a serviceAccountKey.json base64-ben

### Base64 elkészítése Windows-on (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccountKey.json"))

Ezt másold be a Netlify env var-ba.

## 4) Firebase RTDB struktúra
- /users/{uid}/devices/{deviceId}/sensorValue
- /users/{uid}/devices/{deviceId}/plantType
- /users/{uid}/devices/{deviceId}/displayName
- /users/{uid}/devices/{deviceId}/batteryPercent   (ha van)

Push feliratkozás:
- /pushSubscriptions/{uid}/{deviceId} = subscription JSON

## 5) Teszt
1) Deploy Netlify-re (GitHub repo)
2) Nyisd meg HTTPS-en
3) Jelentkezz be
4) Nyomd meg a harangot → Igen → engedélyezd
5) Firebase-ben ellenőrizd: /pushSubscriptions alatt létrejött-e a bejegyzés
6) sendPush fut a Netlify schedule alapján (netlify.toml), de kézzel is meghívhatod:
   /.netlify/functions/sendPush
