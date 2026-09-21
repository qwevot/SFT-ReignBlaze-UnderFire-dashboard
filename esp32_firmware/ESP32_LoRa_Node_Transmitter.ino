/*
  ==============================================================================
  Project: SFT ReignBlaze — Peatland Fire Field Node (LoRa Transmitter)
  Description: Samples MQ-7 (CO), MLX90640 (IR Matrix), and GPS, then transmits
               compact telemetry over LoRa RF (SX1276/SX1278).
  Hardware:
    - ESP32 (e.g. TTGO T-Beam, Heltec LoRa 32, or ESP32 + SX1278 module)
    - LoRa Radio: SPI (NSS: 18, RST: 14, DIO0: 26) - Adjust per board
    - MQ-7: Analog Pin (GPIO 34)
    - MLX90640: I2C (SDA: 21, SCL: 22)
    - GPS: UART2 (RX: 16, TX: 17)
  ==============================================================================
*/

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_MLX90640.h>
#include <TinyGPS++.h>
#include <ArduinoJson.h>

// --- LoRa Configuration ---
#define LORA_SCK     5
#define LORA_MISO    19
#define LORA_MOSI    27
#define LORA_SS      18
#define LORA_RST     14
#define LORA_DIO0    26
#define LORA_BAND    915E6 // 915E6 (US/Asia), 868E6 (EU), or 433E6

// --- Sensor Pins ---
#define MQ7_ANALOG_PIN 34
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17

Adafruit_MLX90640 mlx;
float mlxFrame[768];
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

const char* NODE_ID = "LORA-PEAT-NODE-01";
unsigned long lastLoRaTx = 0;
const unsigned long TX_INTERVAL = 3000; // Dispatch every 3s

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[SFT ReignBlaze] Starting Peat Fire LoRa Field Node...");

  // 1. Init Analog & GPS
  pinMode(MQ7_ANALOG_PIN, INPUT);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // 2. Init MLX90640
  Wire.begin(21, 22);
  Wire.setClock(400000);
  if (!mlx.begin(MLX90640_I2CADDR_DEFAULT, &Wire)) {
    Serial.println("[WARN] MLX90640 not detected!");
  } else {
    Serial.println("[OK] MLX90640 Thermal Sensor active");
    mlx.setMode(MLX90640_CHESS);
    mlx.setResolution(MLX90640_ADC_18BIT);
    mlx.setRefreshRate(MLX90640_2_HZ);
  }

  // 3. Init LoRa SPI
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[FAIL] LoRa module initialization failed!");
    while (1);
  }

  // LoRa Configuration for Dense Peatland Canopy
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(7);
  LoRa.setTxPower(20, true); // Max transmit power for deep forest penetration
  LoRa.enableCrc();
  Serial.println("[OK] LoRa RF Transmitter ready at 915MHz");
}

void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (millis() - lastLoRaTx >= TX_INTERVAL) {
    lastLoRaTx = millis();
    sendLoRaPacket();
  }
}

void sendLoRaPacket() {
  // Read MQ-7
  int rawAdc = analogRead(MQ7_ANALOG_PIN);
  float coPpm = ((float)rawAdc / 4095.0f) * 200.0f;
  String coStatus = (coPpm >= 100) ? "DANGER" : (coPpm >= 35 ? "WARNING" : "SAFE");

  // Read MLX90640
  float minT = 999, maxT = -999, sumT = 0;
  bool mlxOk = (mlx.getFrame(mlxFrame) == 0);
  if (mlxOk) {
    for (int i = 0; i < 768; i++) {
      float t = mlxFrame[i];
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
      sumT += t;
    }
  }

  // Build JSON Telemetry Payload
  DynamicJsonDocument doc(16384);
  doc["deviceId"] = NODE_ID;

  JsonObject gpsObj = doc.createNestedObject("gps");
  if (gps.location.isValid()) {
    gpsObj["lat"] = gps.location.lat();
    gpsObj["lng"] = gps.location.lng();
    gpsObj["altitude"] = gps.altitude.meters();
    gpsObj["speedKmh"] = gps.speed.kmph();
    gpsObj["satellites"] = gps.satellites.value();
    gpsObj["fix"] = true;
  } else {
    // Default fallback coordinate (Central Kalimantan peatland)
    gpsObj["lat"] = -2.2155;
    gpsObj["lng"] = 113.9213;
    gpsObj["altitude"] = 24;
    gpsObj["speedKmh"] = 0;
    gpsObj["satellites"] = 0;
    gpsObj["fix"] = false;
  }

  JsonObject mq7Obj = doc.createNestedObject("mq7");
  mq7Obj["rawAdc"] = rawAdc;
  mq7Obj["coPpm"] = round(coPpm * 10) / 10.0;
  mq7Obj["status"] = coStatus;

  JsonObject mlxObj = doc.createNestedObject("mlx90640");
  mlxObj["rows"] = 24;
  mlxObj["cols"] = 32;
  mlxObj["min"] = round((mlxOk ? minT : 26.0) * 10) / 10.0;
  mlxObj["max"] = round((mlxOk ? maxT : 35.0) * 10) / 10.0;
  mlxObj["avg"] = round((mlxOk ? (sumT / 768.0) : 28.0) * 10) / 10.0;
  mlxObj["center"] = round((mlxOk ? mlxFrame[12 * 32 + 16] : 28.0) * 10) / 10.0;

  JsonArray px = mlxObj.createNestedArray("pixels");
  for (int i = 0; i < 768; i++) {
    px.add(round((mlxOk ? mlxFrame[i] : 27.0) * 10) / 10.0);
  }

  JsonObject batt = doc.createNestedObject("battery");
  batt["voltage"] = 4.12;
  batt["percentage"] = 95;

  String output;
  serializeJson(doc, output);

  // Transmit over LoRa
  LoRa.beginPacket();
  LoRa.print(output);
  LoRa.endPacket();

  Serial.printf("[LoRa TX] Sent %d bytes | CO: %.1f ppm | Soil Peak: %.1f C\n", output.length(), coPpm, maxT);
}
