Növényfigyelő – KÉSZ csomag (Frontend + Backend)

A ZIP-ben 2 mappa van:

1) frontend/  -> ezt töltsd fel a Netlify-s GitHub repódba
2) backend/   -> ebből csinálj külön GitHub repót, és ezt kösd Railway-be

Railway Variables (mind sima szöveg!):
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY   (egysorban, \n-ekkel)
FIREBASE_DB_URL
ONESIGNAL_APP_ID
ONESIGNAL_API_KEY

Indítás Railway-en:
- Start: npm start

Teszt:
- Railway URL + /health
- Railway URL + /run-check
