/*
  ==============================================================================
  Project: SFT ReignBlaze - ESP32 Telemetry Transmitter
  Sensors:
    - MQ-07 (Carbon Monoxide) -> Analog Pin (GPIO 34)
    - MLX90640 (32x24 IR Thermal Matrix) -> I2C (SDA: GPIO 21, SCL: GPIO 22)
    - Neo-6M / Neo-8M GPS -> UART2 (RX2: GPIO 16, TX2: GPIO 17)
  ==============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // ArduinoJson v6 or v7
#include <Wire.h>
#include <Adafruit_MLX90640.h>
#include <TinyGPS++.h>

// --- Wi-Fi Configuration ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// --- Server Endpoint ---
// Replace with the IP address of the machine running the SFT ReignBlaze backend
const char* SERVER_URL = "http://192.168.1.100:5000/api/telemetry";

// --- Hardware Pins ---
#define MQ7_ANALOG_PIN 34
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17

// --- Sensor Objects ---
Adafruit_MLX90640 mlx;
float mlxFrame[768]; // 24 rows * 32 columns

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

unsigned long lastTransmitTime = 0;
const unsigned long TRANSMIT_INTERVAL_MS = 2000; // Sample every 2 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[SFT ReignBlaze] Initializing Hardware Specimen...");

  // 1. Initialize MQ-7 ADC
  pinMode(MQ7_ANALOG_PIN, INPUT);

  // 2. Initialize GPS Serial
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // 3. Initialize MLX90640 I2C
  Wire.begin(21, 22);
  Wire.setClock(400000); // 400kHz I2C for thermal array
  if (!mlx.begin(MLX90640_I2CADDR_DEFAULT, &Wire)) {
    Serial.println("[WARN] MLX90640 not detected on I2C bus!");
  } else {
    Serial.println("[OK] MLX90640 Thermal Sensor initialized");
    mlx.setMode(MLX90640_CHESS);
    mlx.setResolution(MLX90640_ADC_18BIT);
    mlx.setRefreshRate(MLX90640_4_HZ);
  }

  // 4. Connect Wi-Fi
  Serial.printf("[Wi-Fi] Connecting to %s...", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected! Local IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WARN] Wi-Fi connection timeout. Telemetry will retry.");
  }
}

void loop() {
  // Feed GPS parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Periodic Telemetry Dispatch
  if (millis() - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = millis();
    transmitSensorTelemetry();
  }
}

void transmitSensorTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi] Reconnecting...");
    WiFi.reconnect();
    return;
  }

  // --- Read MQ-7 Sensor ---
  int rawAdc = analogRead(MQ7_ANALOG_PIN);
  // Basic linear calibration approximation for MQ-7 (customize based on datasheet curve)
  float coPpm = ((float)rawAdc / 4095.0f) * 200.0f;
  String coStatus = "SAFE";
  if (coPpm >= 100.0f) coStatus = "DANGER";
  else if (coPpm >= 35.0f) coStatus = "WARNING";

  // --- Read MLX90640 Thermal Array ---
  float minTemp = 999.0, maxTemp = -999.0, sumTemp = 0.0;
  bool mlxSuccess = false;
  if (mlx.getFrame(mlxFrame) == 0) {
    mlxSuccess = true;
    for (int i = 0; i < 768; i++) {
      float t = mlxFrame[i];
      if (t < minTemp) minTemp = t;
      if (t > maxTemp) maxTemp = t;
      sumTemp += t;
    }
  }

  float avgTemp = mlxSuccess ? (sumTemp / 768.0f) : 25.0f;
  float centerTemp = mlxSuccess ? mlxFrame[12 * 32 + 16] : 25.0f;

  // --- Construct JSON Payload ---
  DynamicJsonDocument doc(16384);
  doc["deviceId"] = "ESP32-REIGNBLAZE-01";
  doc["rssi"] = WiFi.RSSI();

  // GPS Data
  JsonObject gpsObj = doc.createNestedObject("gps");
  if (gps.location.isValid()) {
    gpsObj["lat"] = gps.location.lat();
    gpsObj["lng"] = gps.location.lng();
    gpsObj["altitude"] = gps.altitude.meters();
    gpsObj["speedKmh"] = gps.speed.kmph();
    gpsObj["satellites"] = gps.satellites.value();
    gpsObj["fix"] = true;
  } else {
    // Fallback if dense peat canopy/no initial satellite fix
    gpsObj["lat"] = -2.34820;
    gpsObj["lng"] = 113.78450;
    gpsObj["altitude"] = 24;
    gpsObj["speedKmh"] = 0;
    gpsObj["satellites"] = 0;
    gpsObj["fix"] = false;
  }

  // MQ-7 Data
  JsonObject mq7Obj = doc.createNestedObject("mq7");
  mq7Obj["rawAdc"] = rawAdc;
  mq7Obj["coPpm"] = round(coPpm * 10) / 10.0;
  mq7Obj["status"] = coStatus;

  // MLX90640 Data
  JsonObject mlxObj = doc.createNestedObject("mlx90640");
  mlxObj["rows"] = 24;
  mlxObj["cols"] = 32;
  mlxObj["min"] = round(minTemp * 10) / 10.0;
  mlxObj["max"] = round(maxTemp * 10) / 10.0;
  mlxObj["avg"] = round(avgTemp * 10) / 10.0;
  mlxObj["center"] = round(centerTemp * 10) / 10.0;

  JsonArray pixels = mlxObj.createNestedArray("pixels");
  for (int i = 0; i < 768; i++) {
    pixels.add(round((mlxSuccess ? mlxFrame[i] : 25.0f) * 10) / 10.0);
  }

  // Battery Telemetry
  JsonObject battObj = doc.createNestedObject("battery");
  battObj["voltage"] = 4.10;
  battObj["percentage"] = 92;

  // --- HTTP POST Transmission ---
  String jsonString;
  serializeJson(doc, jsonString);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(jsonString);
  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] Telemetry POST status: %d\n", httpResponseCode);
  } else {
    Serial.printf("[HTTP] Error on POST: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  http.end();
}
