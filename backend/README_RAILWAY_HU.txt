ESP Növényfigyelő – Railway backend
===================================

Ez a mappa a Node.js + Express + PostgreSQL + Web Push (VAPID) alapú backendet tartalmazza,
amit Railway-en tudsz futtatni. Feladata:

- ESP32 eszköz méréseit fogadni (`POST /api/measurement`)
- a méréseket adatbázisban tárolni
- ha a nedvesség 35% alá esik, push értesítést küldeni azoknak, akik
  az adott device-ra feliratkoztak (`POST /api/subscribe`)
- opcionálisan a frontendnek kiszolgálni a legutóbbi mérést (`GET /api/latest`)

Szükséges environment változók Railway-en (Variables fülön):

- `DATABASE_URL`       – Railway PostgreSQL connection string (automatikus, ha összekötöd)
- `VAPID_PUBLIC_KEY`   – a nyilvános VAPID kulcsod (ugyanaz, mint a frontenden)
- `VAPID_PRIVATE_KEY`  – a privát VAPID kulcsod (csak a backend használja)

Futtatás Railway-en:
- Deploy from GitHub repo
- Add PostgreSQL
- Állítsd be az env változókat
