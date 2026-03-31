function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const type = String(data.type || "soil").toLowerCase();

    const email = String(data.email || "").trim();
    const deviceId = String(data.deviceId || "").trim();
    const plantName = String(data.plantName || "").trim();
    const category = String(data.category || "").trim();

    if (!email || !deviceId) {
      return ContentService.createTextOutput("Hiányzó adat");
    }

    if (type === "air") {
      const aqi = Number(data.aqi);
      const tvoc = Number(data.tvoc);
      const eco2 = Number(data.eco2);
      const airState = String(data.airState || "rossz");

      const subject = "🌬️ Növényfigyelő – Szellőztetés javasolt";
      const htmlBody = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
          <h2 style="color:#b91c1c;">⚠️ Rossz a levegő minősége</h2>
          <p>Érdemes szellőztetni annál a növénynél, amelyik levegőminőség-szenzorral figyeli a szobát.</p>
          <p><b>Növény:</b> ${plantName || "—"}</p>
          <p><b>Eszköz:</b> ${deviceId}</p>
          <p><b>Kategória:</b> ${category || "—"}</p>
          <p><b>Állapot:</b> ${airState}</p>
          <p><b>AQI:</b> ${Number.isFinite(aqi) ? aqi : "—"}</p>
          <p><b>TVOC:</b> ${Number.isFinite(tvoc) ? tvoc : "—"}</p>
          <p><b>eCO2:</b> ${Number.isFinite(eco2) ? eco2 : "—"}</p>
          <hr>
          <p style="font-size:12px;color:#6b7280;">Ezt az üzenetet a Növényfigyelő rendszer küldte.</p>
        </div>
      `;

      MailApp.sendEmail({ to: email, subject, htmlBody });
      return ContentService.createTextOutput("Levegő email elküldve");
    }

    const moisture = Number(data.moisture);
    if (!Number.isFinite(moisture)) {
      return ContentService.createTextOutput("Hiányzó talaj adat");
    }

    if (moisture > 35) {
      return ContentService.createTextOutput("Nem kell riasztás");
    }

    const subject = "💧 Növényfigyelő – Szomjas a növényed!";
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2 style="color:#166534;">💧 Szomjas a növényed – ideje locsolni!</h2>
        <p><b>Növény:</b> ${plantName || "—"}</p>
        <p><b>Eszköz:</b> ${deviceId}</p>
        <p><b>Kijelzett érték:</b> ${moisture}%</p>
        <p><b>Kategória:</b> ${category || "—"}</p>
        <hr>
        <p style="font-size:12px;color:#6b7280;">Ezt az üzenetet a Növényfigyelő rendszer küldte.</p>
      </div>
    `;

    MailApp.sendEmail({ to: email, subject, htmlBody });
    return ContentService.createTextOutput("Talaj email elküldve");
  } catch (err) {
    return ContentService.createTextOutput("Hiba: " + err);
  }
}
