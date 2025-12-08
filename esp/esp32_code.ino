/*
  ESP32 példa kód – Railway backendre küldi a mérést

  FONTOS:
  - Töltsd ki a Wi-Fi adataidat.
  - Állítsd be a RAILWAY_HOST értékét a saját Railway backend URL-edre.
  - A deviceId értéket állítsd arra, amit a webes felületen is használsz (pl. esp32_001).
*/

#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "IDE_IRD_A_WIFI_NEVEDET";
const char* WIFI_PASS = "IDE_IRD_A_WIFI_JELSZAVAD";

// Példa: ha a backend URL-ed: https://esp-plant-backend.up.railway.app
// akkor RAILWAY_HOST = "https://esp-plant-backend.up.railway.app";
const char* RAILWAY_HOST = "https://IDE_IRD_BE_A_RAILWAY_URLT.up.railway.app";

const char* DEVICE_ID = "esp32_001";

// Itt add meg a szenzor lábát, és ahogy a százalékot számolod
const int SOIL_PIN = 34;

void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Csatlakozás Wi-Fi-hez");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi csatlakoztatva, IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi bontva, újracsatlakozás...");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(2000);
    return;
  }

  // Itt csak egy egyszerű példa: analóg értéket olvasunk, és átszámoljuk %-ra
  int raw = analogRead(SOIL_PIN);
  // Ezt a részt igazítsd a saját szenzorodhoz (min/max kalibráció)
  float percent = map(raw, 2600, 1200, 0, 100); // PÉLDA értékek!
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;

  Serial.printf("Nedvesség: %0.1f%% (raw: %d)\n", percent, raw);

  HTTPClient http;
  String url = String(RAILWAY_HOST) + "/api/measurement";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"moisture\":" + String(percent, 1) + "}";
  Serial.println("Küldés ide: " + url);
  Serial.println("Body: " + body);

  int httpCode = http.POST(body);
  if (httpCode > 0) {
    Serial.printf("Válaszkód: %d\n", httpCode);
    String payload = http.getString();
    Serial.println("Válasz: " + payload);
  } else {
    Serial.printf("HTTP hiba: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();

  // Csak példa: 3 percenként küld mérést
  delay(180000);
}
