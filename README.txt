Növényfigyelő – OneSignal Web Push (Netlify)

1) Töltsd fel ezt a mappát GitHubra (a fájlok a projekt gyökerében legyenek):
   - index.html
   - OneSignalSDKWorker.js
   - netlify.toml

2) Netlify: Deploy a GitHub repo-ból.

3) OneSignal: ellenőrizd az App ID-t az index.html-ben:
   appId: "6a595cdc-e443-4179-bc11-95241c8ad20f"

Megjegyzés:
- A push engedélyt a böngésző kérdezi (ez normális).
- A harang a kiválasztott kártya (fiók+eszköz) alapján kapcsol be/ki.
