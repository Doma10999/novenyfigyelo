Növényfigyelő – Railway backend (Node.js + PostgreSQL + Web Push)

LÉPÉSEK RAILWAY-EN:
-------------------

1) A GitHub repóban ez a backend mappa legyen a /backend útvonalon.
   A Railway szolgáltatás Root Directory-ja: /backend

2) Railway-en a Variables fülön állítsd be az alábbiakat:
   - DATABASE_URL  → a Railway Postgres szolgáltatásról "DATABASE_URL" (vagy a saját connection string)
   - VAPID_PUBLIC_KEY  → a böngészős push kulcs publikus része
   - VAPID_PRIVATE_KEY → a VAPID kulcs privát része

3) Deploy után a backend alap URL-je valami ilyesmi lesz:
   https://valami.up.railway.app

   Elérhető végpontok:
     GET  /                          → healthcheck
     POST /subscribe                 → feliratkozás mentése
     POST /notify-low-moisture      → alacsony nedvesség esetén értesítés küldése

/subscribe végpont:
-------------------
  Body (JSON):
    {
      "userId": "FELHASZNALO_AZONOSITO",
      "subscription": { ... böngésző push subscription objektum ... }
    }

/notify-low-moisture végpont:
-----------------------------
  Ezt hívhatja az ESP32 (vagy más backend logika).

  Body (JSON):
    {
      "userId": "FELHASZNALO_AZONOSITO",
      "moisture": 30,
      "threshold": 35,          // opcionális, alapértelmezés 35
      "plantName": "Anyósnyelv" // opcionális
    }

  Ha moisture < threshold:
    - a megadott userId-hez tartozó összes subscription-re push értesítés megy.
