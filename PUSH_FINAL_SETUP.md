# Növényfigyelő – végleges Push beállítás

Ez a verzió a weboldali Web Push klienshez készült.

## 1. Weboldal

A Netlify a repository gyökerét publikálja. Ha a `main` ágba bekerül ez a verzió, a Netlify automatikusan telepíti, ha a GitHub-deploy kapcsolat aktív.

Használt domain:

- `https://noveny-figyelo.netlify.app`
- a másodlagos `https://novenyfigyelo.netlify.app` is engedélyezhető

## 2. Cloudflare Worker

Worker URL:

`https://novenyfigyelo-push.drobnidominik.workers.dev`

A Workerben a következő Variables and secrets értékek legyenek meg:

### Text

- `ALLOWED_ORIGINS` = `https://novenyfigyelo.netlify.app,https://noveny-figyelo.netlify.app`
- `APP_URL` = `https://noveny-figyelo.netlify.app/`
- `FIREBASE_DB_URL` = `https://plant-monitor-3976f-default-rtdb.europe-west1.firebasedatabase.app`
- `FIREBASE_PROJECT_ID` = `plant-monitor-3976f`
- `PUSH_ICON_URL` = `https://noveny-figyelo.netlify.app/icon2.png`
- `PUSH_BADGE_URL` = `https://noveny-figyelo.netlify.app/icon2.png`
- `VAPID_PUBLIC_KEY` = a jelenlegi VAPID publikus kulcs
- `VAPID_SUBJECT` = `mailto:drobnidominik@gmail.com`

### Secret

- `VAPID_PRIVATE_KEY` = a VAPID privát kulcs
- `PUSH_API_SECRET` = egy hosszú, véletlenszerű titkos kulcs, amelyet csak a szerveroldali push-küldő használ

A `VAPID_PRIVATE_KEY` és `PUSH_API_SECRET` soha ne kerüljön a weboldal JavaScriptjébe vagy publikus GitHub fájlba.

## 3. KV binding

Cloudflare Worker KV binding:

- Binding: `PUSH_SUBS`
- Namespace ID: `c74cc3e33f2c408d93a7267300450a76`

## 4. Plus jogosultság

A Worker a bejelentkezett Firebase felhasználó saját UID-ját használja. Az aktív Plus állapotot itt ellenőrzi:

`users/{uid}/subscription`

A push az adott felhasználói fiókhoz és az adott böngészőhöz/telefonhoz kötődik. Az email értesítés címének nem kell azonosnak lennie a Firebase belépési emaillel.

## 5. Böngésző

- Chrome / Edge / Android: külön telepítés nem szükséges.
- A felhasználónak egyszer engedélyeznie kell az értesítéseket.
- iPhone/iPad: a weboldalt előbb a Főképernyőhöz kell adni, majd a telepített webappból lehet Web Push értesítést engedélyezni.

## 6. Ellenőrzés

A Cloudflare Worker health végpontja:

`https://novenyfigyelo-push.drobnidominik.workers.dev/health`

A weboldalon a csengőnél aktív Plus fióknál meg kell jelennie a `Push bekapcsolása` gombnak. Bekapcsolás után ugyanazon az eszközön `Push bekapcsolva ezen az eszközön.` szöveg jelenik meg.

## 7. Fontos

A weboldali feliratkozás önmagában nem hoz létre automatikus talaj-/akku-/levegő riasztást. A tényleges push-küldést a szerveroldali értesítési folyamatnak kell meghívnia a Worker `/send` végpontján, `X-Push-Secret` fejléccel. Ezt célszerű ugyanabba a Google Apps Script folyamatba kötni, amely az email értesítéseket is küldi.
