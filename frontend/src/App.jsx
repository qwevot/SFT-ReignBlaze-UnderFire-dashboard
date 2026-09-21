import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MapTrackingView from './components/MapTrackingView';
import ThermalViewer from './components/ThermalViewer';
import TelemetryCharts from './components/TelemetryCharts';
import DeviceStatusCard from './components/DeviceStatusCard';

export default function App() {
  const [latestData, setLatestData] = useState(null);
  const [history, setHistory] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [simulatorActive, setSimulatorActive] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const wsRef = useRef(null);

  // Connect WebSocket & fetch initial history
  useEffect(() => {
    // Initial fetch via REST API
    fetch('/api/telemetry/history?limit=500')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHistory(data);
          setLatestData(data[data.length - 1]);
        }
      })
      .catch(err => console.error('Failed to fetch initial history:', err));

    // Establish WebSocket Connection
    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:5000/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected to SFT ReignBlaze backend');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'INIT_STATE') {
            if (message.data.latest) setLatestData(message.data.latest);
            if (message.data.history) setHistory(message.data.history);
            if (typeof message.data.simulatorActive === 'boolean') {
              setSimulatorActive(message.data.simulatorActive);
            }
          } else if (message.type === 'TELEMETRY_UPDATE') {
            const newPacket = message.data;
            setLatestData(newPacket);
            setHistory(prev => {
              const updated = [...prev, newPacket];
              return updated.length > 600 ? updated.slice(-600) : updated;
            });
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected. Reconnecting in 2s...');
        setWsConnected(false);
        setTimeout(connectWs, 2000);
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
        ws.close();
      };
    }

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Toggle backend simulator
  const handleToggleSimulator = async () => {
    try {
      const res = await fetch('/api/simulator/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !simulatorActive })
      });
      const data = await res.json();
      setSimulatorActive(data.simulatorActive);
    } catch (err) {
      console.error('Failed to toggle simulator:', err);
    }
  };

  // Clear waypoint history
  const handleClearHistory = async () => {
    try {
      await fetch('/api/telemetry/clear', { method: 'DELETE' });
      setHistory([]);
      setSelectedPoint(null);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const selectedIndex = selectedPoint 
    ? history.findIndex(p => p.id === selectedPoint.id || p.timestamp === selectedPoint.timestamp)
    : -1;

  const [panelMode, setPanelMode] = useState('docked'); // 'docked' (440px), 'expanded' (680px), 'collapsed' (56px)
  const [panelWidth, setPanelWidth] = useState(440);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(440);

  // Drag-to-resize side panel horizontally
  const handleMouseDownResize = (e) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = startXRef.current - moveEvent.clientX; // Dragging LEFT increases width
      const newWidth = Math.max(340, Math.min(window.innerWidth * 0.75, startWidthRef.current + deltaX));
      setPanelWidth(newWidth);
      if (panelMode === 'collapsed') setPanelMode('docked');
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const peakTemp = latestData?.mlx90640?.max ?? 28.5;
  const coPpm = latestData?.mq7?.coPpm ?? 12.0;
  const loraRssi = latestData?.lora?.rssi ?? -85;
  const fireIndex = latestData?.fireRisk?.index ?? 15;

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#f8fafc] text-slate-900 selection:bg-rose-500/20">
      {/* Fixed Header on Top */}
      <Header
        latestData={latestData}
        wsConnected={wsConnected}
        simulatorActive={simulatorActive}
        onToggleSimulator={handleToggleSimulator}
        historyCount={history.length}
        onClearHistory={handleClearHistory}
      />

      {/* Full-Screen Spatial Map Canvas below Header */}
      <div className="absolute top-[57px] left-0 right-0 bottom-0 z-0">
        <MapTrackingView
          latestGps={latestData?.gps}
          history={history}
          onSelectPoint={(pt) => {
            setSelectedPoint(pt);
            if (panelMode === 'collapsed') setPanelMode('docked');
          }}
          selectedPoint={selectedPoint}
        />
      </div>

      {/* Side-Docked Telemetry & Thermal Panel (Desktop: Right-Side Dock, Mobile: Bottom Sheet) */}
      <div
        style={{
          width: window.innerWidth >= 1024 
            ? (panelMode === 'collapsed' ? '56px' : `${panelWidth}px`) 
            : '100%'
        }}
        className={`fixed z-30 bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl transition-all duration-200 ease-out flex flex-col overflow-hidden
          /* Mobile: Bottom Sheet */
          max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:rounded-t-3xl max-lg:border-t
          ${window.innerWidth < 1024 ? (panelMode === 'collapsed' ? 'max-lg:h-[72px]' : panelMode === 'expanded' ? 'max-lg:h-[85vh]' : 'max-lg:h-[45vh]') : ''}
          /* Desktop: Right Side Dock */
          lg:top-[68px] lg:right-4 lg:bottom-4 lg:rounded-2xl
        `}
      >
        {/* Left Resize Drag Edge (Desktop only) */}
        {panelMode !== 'collapsed' && (
          <div
            onMouseDown={handleMouseDownResize}
            title="Drag to resize panel"
            className="hidden lg:block absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-amber-500/30 transition-colors z-20"
          />
        )}

        {/* Panel Header & Fast Snap Bar */}
        <div className="p-3 border-b border-slate-200 flex-shrink-0 bg-white/80 select-none">
          {/* Mobile Top Pill Handle */}
          <div className="lg:hidden w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-2" />

          <div className="flex items-center justify-between gap-2">
            {panelMode === 'collapsed' ? (
              <div className="w-full flex flex-col items-center gap-2 py-1">
                <button
                  onClick={() => setPanelMode('docked')}
                  title="Expand telemetry dock"
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  ◀
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 truncate">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider truncate">
                    Telemetry & Analytics Dock
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setPanelMode('docked');
                      setPanelWidth(440);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                      panelMode === 'docked' && panelWidth === 440
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => {
                      setPanelMode('expanded');
                      setPanelWidth(680);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                      panelWidth >= 600
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Wide
                  </button>
                  <button
                    onClick={() => setPanelMode('collapsed')}
                    title="Minimize panel"
                    className="hidden lg:block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                  >
                    ▶
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick Metrics Bar (when not collapsed) */}
          {panelMode !== 'collapsed' && (
            <div className="grid grid-cols-4 gap-1 text-center mt-2 pt-2 border-t border-slate-100 text-[10px]  text-slate-600">
              <span className="truncate">Peak: <strong className="text-rose-600 font-bold">{peakTemp.toFixed(1)}°C</strong></span>
              <span className="truncate">CO: <strong className="text-cyan-700 font-bold">{coPpm.toFixed(1)}</strong></span>
              <span className="truncate">Risk: <strong className={fireIndex > 50 ? 'text-rose-600' : 'text-emerald-700'}>{fireIndex}</strong></span>
              <span className="truncate">LoRa: <strong className="text-slate-800">{loraRssi}dBm</strong></span>
            </div>
          )}
        </div>

        {/* Scrollable Subordinate Data Content */}
        {panelMode !== 'collapsed' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Live MLX90640 Thermal Infrared Feed */}
            <ThermalViewer
              thermalData={selectedPoint ? selectedPoint.mlx90640 : latestData?.mlx90640}
              selectedPoint={selectedPoint}
              pointIndex={selectedIndex}
              onClearSelection={() => setSelectedPoint(null)}
              title={selectedPoint ? "Selected Point Thermal IR" : "MLX90640 Thermal IR Camera"}
            />

            {/* Historical Trends & Analytics */}
            <TelemetryCharts 
              history={history} 
              selectedPoint={selectedPoint}
              onSelectPoint={(pt) => setSelectedPoint(pt)}
            />

            {/* Hardware Diagnostics & Telemetry Link */}
            <DeviceStatusCard latestData={latestData} />

            {/* Panel Footer */}
            <footer className="pt-2 pb-4 text-center text-[10px] text-slate-400  border-t border-slate-100">
              ReignBlaze 2026
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
