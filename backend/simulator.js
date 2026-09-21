// Simulator for SFT ReignBlaze: Peatland Smoldering Fire Detection System
// Hardware: ESP32 + LoRa (SX1276/SX1278) + MQ-07 (CO) + MLX90640 (Thermal IR 24x32) + GPS

const ROWS = 24;
const COLS = 32;

// Base coordinates: Secluded Tropical Peat Dome (Sebangau Peat Swamp Forest & Canal Transect, Central Kalimantan, Indonesia)
const PEATLAND_BASE_LAT = -2.34820;
const PEATLAND_BASE_LNG = 113.78450;

let baseLat = PEATLAND_BASE_LAT; 
let baseLng = PEATLAND_BASE_LNG;
let heading = 0.8;
let stepIndex = 0;

// Subsurface & Surface Peat Fire Hotspots located within the surveyed square peat field
const peatFireHotspots = [
  { latOffset: 0.00065, lngOffset: 0.00085, coIntensity: 210, heatPeak: 86.5, radius: 0.00038, label: "Subsurface Peat Smoldering (Sector E-4)" },
  { latOffset: 0.00125, lngOffset: 0.00035, coIntensity: 295, heatPeak: 116.0, radius: 0.00042, label: "Active Subsurface Combustion (Sector N-2)" },
  { latOffset: 0.00025, lngOffset: 0.00135, coIntensity: 130, heatPeak: 67.0, radius: 0.00030, label: "Residual Peat Embers (Canal Edge)" }
];

/**
 * Generate MLX90640 24x32 (768 pixels) thermal array for peat soil surface
 */
function generateThermalMatrix(ambientSoilTemp = 29.5, maxHotspot = 34.0) {
  const pixels = new Array(ROWS * COLS);
  const spotX = 14 + Math.sin(stepIndex * 0.25) * 7 + (Math.random() - 0.5) * 2;
  const spotY = 11 + Math.cos(stepIndex * 0.25) * 5 + (Math.random() - 0.5) * 2;
  const spotRadius = 4.0 + Math.random() * 1.5;

  let min = 999;
  let max = -999;
  let sum = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const dist = Math.sqrt(Math.pow(c - spotX, 2) + Math.pow(r - spotY, 2));
      
      // Ambient peat surface temperature with micro-terrain variation
      let temp = ambientSoilTemp + (Math.random() - 0.5) * 1.2;
      
      // Thermal bloom from subsurface smoldering heat conduction
      if (dist < spotRadius * 2.8) {
        const falloff = Math.exp(-Math.pow(dist / spotRadius, 2));
        temp += (maxHotspot - ambientSoilTemp) * falloff;
      }

      temp = Math.round(temp * 10) / 10;
      pixels[idx] = temp;

      if (temp < min) min = temp;
      if (temp > max) max = temp;
      sum += temp;
    }
  }

  const avg = Math.round((sum / (ROWS * COLS)) * 10) / 10;
  const centerIdx = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  const center = pixels[centerIdx];

  return {
    rows: ROWS,
    cols: COLS,
    pixels,
    min,
    max,
    avg,
    center
  };
}

/**
 * UnderFire Inference Engine:
 * - CNN representation from MLX90640 spatial thermal distribution
 * - LSTM representation from ZE07-CO time-series (concentration, delta, moving avg)
 * - Dynamic Gated Fusion to yield Smoldering Probability P(smoldering)
 */
function calculatePeatFireIndex(coPpm, maxTemp, deltaCo = 0, movingAvgCo = coPpm) {
  const cnnThermalScore = Math.min(1.0, Math.max(0.0, (maxTemp - 30.0) / 45.0));
  const baseCoScore = Math.min(1.0, Math.max(0.0, coPpm / 120.0));
  const rateScore = Math.min(1.0, Math.max(0.0, deltaCo / 15.0));
  const lstmCoScore = Math.min(1.0, (0.6 * baseCoScore) + (0.25 * rateScore) + (0.15 * Math.min(1.0, movingAvgCo / 100.0)));

  const gateWeight = 1 / (1 + Math.exp(-(2.5 * (cnnThermalScore - lstmCoScore))));
  const smolderingProb = Math.min(1.0, Math.max(0.0, (gateWeight * cnnThermalScore) + ((1 - gateWeight) * lstmCoScore)));

  const isAnomalyCandidate = smolderingProb >= 0.50 || coPpm >= 40.0 || maxTemp >= 52.0;

  let level = "NORMAL PEAT";
  if (smolderingProb >= 0.75 || (coPpm >= 100 && maxTemp >= 60)) {
    level = "CRITICAL SMOLDERING CANDIDATE";
  } else if (isAnomalyCandidate) {
    level = "ELEVATED ANOMALY CANDIDATE";
  }

  return {
    probability: Number(smolderingProb.toFixed(3)),
    percentage: Math.round(smolderingProb * 100),
    isAnomalyCandidate,
    level,
    fusion: {
      cnnThermalScore: Number(cnnThermalScore.toFixed(3)),
      lstmCoScore: Number(lstmCoScore.toFixed(3)),
      gateWeight: Number(gateWeight.toFixed(3))
    }
  };
}

/**
 * Helper to compute sensor readings for a specific coordinate
 */
function sampleSensorsAtCoordinate(lat, lng, curStep, timestampStr, deviceId) {
  let coPpm = 9.0 + Math.sin(curStep * 0.14) * 3.5 + (Math.random() - 0.5) * 1.5;
  let hotspotTemp = 30.0 + Math.random() * 1.8;
  let detectedHazard = null;

  for (const spot of peatFireHotspots) {
    const dLat = Math.abs(lat - (PEATLAND_BASE_LAT + spot.latOffset));
    const dLng = Math.abs(lng - (PEATLAND_BASE_LNG + spot.lngOffset));
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    const radius = spot.radius || 0.00035;

    if (dist < radius) {
      const proximity = Math.pow(1 - (dist / radius), 1.3);
      coPpm += spot.coIntensity * proximity;
      hotspotTemp = Math.max(hotspotTemp, 30.0 + (spot.heatPeak - 30.0) * proximity);
      detectedHazard = spot.label;
    }
  }

  coPpm = Math.max(3.5, Math.round(coPpm * 10) / 10);
  
  let coStatus = "SAFE";
  if (coPpm >= 100) {
    coStatus = "DANGER";
  } else if (coPpm >= 35) {
    coStatus = "WARNING";
  }

  const thermalData = generateThermalMatrix(29.0, hotspotTemp);
  const fireIndex = calculatePeatFireIndex(coPpm, thermalData.max);

  const loraRssi = -75 - Math.floor((curStep % 50) * 0.5) + Math.floor((Math.random() - 0.5) * 3);
  const loraSnr = Number((9.5 - (curStep % 50) * 0.08 + (Math.random() - 0.5)).toFixed(1));

  return {
    id: `pkt_lora_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    deviceId,
    timestamp: timestampStr,
    gps: {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      altitude: Math.round(24 + Math.sin(curStep * 0.05) * 3),
      speedKmh: Number((2.6 + Math.sin(curStep * 0.1) * 0.6).toFixed(1)),
      satellites: 12,
      fix: true
    },
    mq7: {
      rawAdc: Math.min(4095, Math.round(coPpm * 13.2)),
      coPpm: coPpm,
      status: coStatus,
      hazardWarning: detectedHazard
    },
    mlx90640: thermalData,
    fireRisk: fireIndex,
    lora: {
      rssi: loraRssi,
      snr: loraSnr,
      frequency: 915.0,
      spreadingFactor: "SF9",
      bandwidth: "125kHz",
      gatewayId: "GW-PEAT-BASE-01"
    },
    battery: {
      voltage: Number((4.18 - (curStep * 0.0004)).toFixed(2)),
      percentage: Math.max(20, Math.round(98 - (curStep * 0.04)))
    }
  };
}

/**
 * Pre-seeds a natural, organic area survey covering an overall square peat field plot (~140 points)
 * Models authentic operator field traversal with natural meandering, GPS drift, obstacle detours, and variable pacing.
 */
function generatePreSeededSurveyRoute(deviceId = "LORA-PEAT-NODE-01") {
  const history = [];
  const GRID_ROWS = 12;
  const GRID_COLS = 12;
  const LAT_STEP = 0.000145; // ~16m average row spacing
  const LNG_STEP = 0.000145; // ~16m average col spacing

  const totalPoints = GRID_ROWS * GRID_COLS;
  const now = Date.now();
  const timeStepMs = 12000; // 12 seconds per survey station
  const startTime = now - (totalPoints * timeStepMs);

  let pointIdx = 0;
  let lastLat = PEATLAND_BASE_LAT;
  let lastLng = PEATLAND_BASE_LNG;

  for (let r = 0; r < GRID_ROWS; r++) {
    const isEvenRow = (r % 2 === 0);
    // Lawnmower / serpentine traverse with organic field wandering
    for (let c = 0; c < GRID_COLS; c++) {
      const colIdx = isEvenRow ? c : (GRID_COLS - 1 - c);
      
      // Base lattice position for the square area
      const targetBaseLat = PEATLAND_BASE_LAT + (r * LAT_STEP);
      const targetBaseLng = PEATLAND_BASE_LNG + (colIdx * LNG_STEP);

      // Natural chaotic perturbations (swamp terrain avoidance, GPS dilution of precision, root dodging)
      const latJitter = (Math.sin(pointIdx * 1.3) * 0.000045) + ((Math.random() - 0.5) * 0.000040);
      const lngJitter = (Math.cos(pointIdx * 1.1) * 0.000045) + ((Math.random() - 0.5) * 0.000040);

      const lat = Number((targetBaseLat + latJitter).toFixed(6));
      const lng = Number((targetBaseLng + lngJitter).toFixed(6));

      const timestamp = new Date(startTime + (pointIdx * timeStepMs)).toISOString();
      const packet = sampleSensorsAtCoordinate(lat, lng, pointIdx, timestamp, deviceId);
      history.push(packet);

      lastLat = lat;
      lastLng = lng;
      pointIdx++;
    }
  }

  // Set real-time simulator to continue forward organically from exit perimeter of the square plot
  baseLat = lastLat;
  baseLng = lastLng;
  heading = 0.35;
  stepIndex = pointIdx;

  return history;
}

/**
 * Generate synthetic sensor telemetry packet from LoRa field node for live streaming
 */
function generateTelemetryPacket(deviceId = "LORA-PEAT-NODE-01") {
  stepIndex++;

  // Step forward smoothly from perimeter of surveyed square plot
  heading += (Math.random() - 0.5) * 0.18;
  const latDelta = Math.cos(heading) * 0.000035;
  const lngDelta = Math.sin(heading) * 0.000035;

  baseLat += latDelta;
  baseLng += lngDelta;

  return sampleSensorsAtCoordinate(baseLat, baseLng, stepIndex, new Date().toISOString(), deviceId);
}

module.exports = {
  generateTelemetryPacket,
  generatePreSeededSurveyRoute,
  generateThermalMatrix,
  calculatePeatFireIndex
};
