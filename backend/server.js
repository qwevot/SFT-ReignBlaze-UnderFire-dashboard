const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { generateTelemetryPacket, generatePreSeededSurveyRoute, calculatePeatFireIndex } = require('./simulator');

const path = require('path');
const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend assets when built
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// In-memory buffer of recorded peat survey points
const MAX_HISTORY = 1000;
let isSimulatorRunning = true;
let simulationInterval = null;

// Pre-seed contiguous square grid area survey covering Sebangau Peat Dome plot (144 points)
let telemetryHistory = generatePreSeededSurveyRoute("LORA-PEAT-NODE-01");
let latestReading = telemetryHistory.length > 0 ? telemetryHistory[telemetryHistory.length - 1] : null;

// Broadcast helper for WebSockets
function broadcastTelemetry(data) {
  const payload = JSON.stringify({ type: 'TELEMETRY_UPDATE', data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    system: 'SFT ReignBlaze Peatland Fire Telemetry Core',
    serverTime: new Date().toISOString(),
    simulatorActive: isSimulatorRunning,
    activeWsClients: wss.clients.size,
    historyCount: telemetryHistory.length,
    latestDevice: latestReading ? latestReading.deviceId : 'None',
    loraGateway: latestReading?.lora?.gatewayId || 'GW-PEAT-BASE-01'
  });
});

app.get('/api/telemetry/latest', (req, res) => {
  if (!latestReading) {
    return res.status(404).json({ error: 'No telemetry recorded yet.' });
  }
  res.json(latestReading);
});

app.get('/api/telemetry/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const sliced = telemetryHistory.slice(-limit);
  res.json(sliced);
});

// Endpoint for LoRa Gateway ESP32 to POST parsed packets
app.post('/api/telemetry', (req, res) => {
  const data = req.body;
  
  if (!data || !data.gps || !data.mq7) {
    return res.status(400).json({ error: 'Invalid payload. Requires gps and mq7 objects.' });
  }

  const coPpm = data.mq7.coPpm || 0;
  const maxTemp = data.mlx90640?.max || 30.0;
  const fireRisk = data.fireRisk || calculatePeatFireIndex(coPpm, maxTemp);

  const packet = {
    id: data.id || `pkt_lora_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    deviceId: data.deviceId || 'LORA-PEAT-NODE-01',
    timestamp: data.timestamp || new Date().toISOString(),
    gps: data.gps,
    mq7: data.mq7,
    mlx90640: data.mlx90640 || null,
    fireRisk: fireRisk,
    lora: data.lora || {
      rssi: -82,
      snr: 8.0,
      frequency: 915.0,
      spreadingFactor: "SF9",
      bandwidth: "125kHz",
      gatewayId: "GW-PEAT-BASE-01"
    },
    battery: data.battery || { voltage: 4.05, percentage: 88 }
  };

  latestReading = packet;
  telemetryHistory.push(packet);
  if (telemetryHistory.length > MAX_HISTORY) {
    telemetryHistory.shift();
  }

  broadcastTelemetry(packet);
  return res.status(201).json({ success: true, id: packet.id });
});

// Toggle simulator on/off
app.post('/api/simulator/toggle', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled === 'boolean') {
    isSimulatorRunning = enabled;
  } else {
    isSimulatorRunning = !isSimulatorRunning;
  }

  if (isSimulatorRunning && !simulationInterval) {
    startSimulationLoop();
  } else if (!isSimulatorRunning && simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  res.json({ simulatorActive: isSimulatorRunning });
});

app.delete('/api/telemetry/clear', (req, res) => {
  telemetryHistory = [];
  res.json({ message: 'Peatland survey history cleared' });
});

// WebSocket connection lifecycle
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    data: {
      latest: latestReading,
      history: telemetryHistory.slice(-500),
      simulatorActive: isSimulatorRunning
    }
  }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('WS parse error:', err);
    }
  });
});

// Emits simulated LoRa telemetry packet every 1.5s
function startSimulationLoop() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(() => {
    if (!isSimulatorRunning) return;
    const packet = generateTelemetryPacket("LORA-PEAT-NODE-01");
    latestReading = packet;
    telemetryHistory.push(packet);
    if (telemetryHistory.length > MAX_HISTORY) {
      telemetryHistory.shift();
    }
    broadcastTelemetry(packet);
  }, 1500);
}

startSimulationLoop();

// SPA Fallback: send index.html if static build is present
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('UnderFire Backend Active. Frontend build not found. Run "npm run build" in the frontend directory.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`[SFT ReignBlaze] Peat Fire Telemetry Ingestion Core alive at http://localhost:${PORT}`);
  console.log(`[WebSocket Stream] ws://localhost:${PORT}/ws`);
});
