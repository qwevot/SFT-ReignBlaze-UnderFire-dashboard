/*
  ==============================================================================
  Project: SFT ReignBlaze — Peat Fire Base Station (LoRa Gateway Receiver)
  Description: Listens for incoming LoRa packets from field nodes in the peatland,
               attaches LoRa RSSI/SNR signal quality metrics, and relays the payload
               to the Node.js backend server via Wi-Fi HTTP POST.
  ==============================================================================
*/

#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Wi-Fi Credentials for Base Station ---
const char* WIFI_SSID = "YOUR_BASE_STATION_WIFI";
const char* WIFI_PASS = "YOUR_BASE_STATION_PASS";

// --- Node.js Backend Server URL ---
const char* SERVER_URL = "http://192.168.1.100:5000/api/telemetry";

// --- LoRa SPI Pins ---
#define LORA_SCK     5
#define LORA_MISO    19
#define LORA_MOSI    27
#define LORA_SS      18
#define LORA_RST     14
#define LORA_DIO0    26
#define LORA_BAND    915E6

const char* GATEWAY_ID = "GW-PEAT-BASE-01";

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[SFT ReignBlaze] Starting LoRa Base Station Gateway...");

  // 1. Connect Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[Wi-Fi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[Wi-Fi] Connected! Gateway IP: " + WiFi.localIP().toString());

  // 2. Initialize LoRa Receiver
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[FAIL] LoRa initialization failed!");
    while (1);
  }

  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(7);
  LoRa.enableCrc();
  Serial.println("[OK] LoRa Gateway Listening on 915MHz...");
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incomingPayload = "";
    while (LoRa.available()) {
      incomingPayload += (char)LoRa.read();
    }

    int packetRssi = LoRa.packetRssi();
    float packetSnr = LoRa.packetSnr();

    Serial.printf("\n[LoRa RX] Received %d bytes | RSSI: %d dBm | SNR: %.2f dB\n", packetSize, packetRssi, packetSnr);

    // Parse and augment with Gateway LoRa RF telemetry
    DynamicJsonDocument doc(20480);
    DeserializationError error = deserializeJson(doc, incomingPayload);

    if (!error) {
      JsonObject loraObj = doc.createNestedObject("lora");
      loraObj["rssi"] = packetRssi;
      loraObj["snr"] = round(packetSnr * 10) / 10.0;
      loraObj["frequency"] = 915.0;
      loraObj["spreadingFactor"] = "SF9";
      loraObj["gatewayId"] = GATEWAY_ID;

      String finalPayload;
      serializeJson(doc, finalPayload);

      // Relay to Backend
      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(SERVER_URL);
        http.addHeader("Content-Type", "application/json");
        int httpCode = http.POST(finalPayload);
        if (httpCode > 0) {
          Serial.printf("[HTTP POST] Relayed to Backend -> Status: %d\n", httpCode);
        } else {
          Serial.printf("[HTTP POST] Relay failed: %s\n", http.errorToString(httpCode).c_str());
        }
        http.end();
      }
    } else {
      Serial.println("[WARN] Invalid JSON received over LoRa");
    }
  }
}
