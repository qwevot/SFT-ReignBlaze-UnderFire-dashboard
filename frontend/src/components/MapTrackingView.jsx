import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

/**
 * Continuous Color Gradient for UnderFire Smoldering Probability P(smoldering)
 * Interpolates from Green (Normal) -> Cyan -> Yellow -> Orange -> Crimson (Critical Anomaly)
 */
export function getProbabilityColor(prob = 0) {
  const p = Math.max(0, Math.min(1, prob));
  if (p < 0.20) return '#10b981'; // Safe emerald (Normal Peat)
  if (p < 0.40) return '#06b6d4'; // Cyan
  if (p < 0.60) return '#eab308'; // Amber / Warning
  if (p < 0.80) return '#f97316'; // Deep Orange (Elevated smoldering)
  return '#ef4444';                // Crimson Red (Critical Smoldering Outbreak)
}

/**
 * Smooth Continuous Heatmap Layer:
 * Renders an un-stacked, seamless Gaussian kernel density heat canvas across the surveyed peat dome.
 */
function SmoothHeatmapLayer({ points, visible = true }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible || !points || points.length === 0) return;

    // Convert points to [lat, lng, intensity] where intensity is smoldering probability
    const heatData = points.map(pt => {
      const prob = pt.fireRisk?.probability ?? (pt.fireRisk?.index ? pt.fireRisk.index / 100 : 0.1);
      return [pt.gps.lat, pt.gps.lng, Math.max(0.12, Math.min(1.0, prob))];
    });

    const heatLayer = L.heatLayer(heatData, {
      radius: 28,
      blur: 24,
      maxZoom: 19,
      max: 1.0,
      minOpacity: 0.35,
      gradient: {
        0.10: '#10b981', // Safe emerald (Normal Peat)
        0.30: '#06b6d4', // Cyan
        0.50: '#eab308', // Amber / Moderate smoldering
        0.70: '#f97316', // Orange / Elevated smoldering
        0.90: '#ef4444'  // Crimson Red (Critical outbreak)
      }
    });

    heatLayer.addTo(map);

    return () => {
      if (map && heatLayer) {
        map.removeLayer(heatLayer);
      }
    };
  }, [map, points, visible]);

  return null;
}

function MapRecenterController({ center, autoFollow }) {
  const map = useMap();
  useEffect(() => {
    if (autoFollow && center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.8 });
    }
  }, [center, autoFollow, map]);
  return null;
}

export default function MapTrackingView({ 
  latestGps, 
  history = [], 
  onSelectPoint, 
  selectedPoint 
}) {
  const [autoFollow, setAutoFollow] = useState(true);
  const [filterAnomaliesOnly, setFilterAnomaliesOnly] = useState(false);

  // Default coordinate centered on Secluded Peatland Dome Field Zone (Sebangau National Park Peat Swamp Forest, Central Kalimantan)
  const currentPos = latestGps?.lat && latestGps?.lng ? [latestGps.lat, latestGps.lng] : [-2.34820, 113.78450];
  const polylineCoords = history.map(item => [item.gps.lat, item.gps.lng]);

  // Determine anomaly candidates count
  const anomalyCount = useMemo(() => {
    return history.filter(pt => {
      const prob = pt.fireRisk?.probability ?? (pt.fireRisk?.index ? pt.fireRisk.index / 100 : 0);
      return prob >= 0.50 || pt.fireRisk?.isAnomalyCandidate || (pt.mq7?.coPpm || 0) >= 40.0;
    }).length;
  }, [history]);

  // Filtered points for map display
  const displayedHistory = useMemo(() => {
    if (!filterAnomaliesOnly) return history;
    return history.filter(pt => {
      const prob = pt.fireRisk?.probability ?? (pt.fireRisk?.index ? pt.fireRisk.index / 100 : 0);
      return prob >= 0.50 || pt.fireRisk?.isAnomalyCandidate || (pt.mq7?.coPpm || 0) >= 40.0;
    });
  }, [history, filterAnomaliesOnly]);

  // Live Pulse Icon for Field Node
  const liveIcon = L.divIcon({
    className: 'custom-live-icon',
    html: `
      <div style="position: relative; width: 28px; height: 28px;">
        <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.45); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; inset: 3px; border-radius: 9999px; background-color: #ef4444; border: 2.5px solid #ffffff; box-shadow: 0 0 14px rgba(239,68,68,0.95);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100">
      {/* Floating Map Control Bar - Top Center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-xl px-3.5 py-2.5 flex items-center gap-3 pointer-events-auto whitespace-nowrap">
        <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Spatial Heatmap</h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <span className="">{anomalyCount}</span> {anomalyCount === 1 ? 'Anomaly' : 'Anomalies'}
          </span>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2">
          {/* Anomaly Filter Toggle */}
          <button
            onClick={() => setFilterAnomaliesOnly(!filterAnomaliesOnly)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
              filterAnomaliesOnly
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span>{filterAnomaliesOnly ? 'Anomalies Only' : 'All Points'}</span>
          </button>

          {/* Auto Follow Button */}
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
              autoFollow
                ? 'bg-orange-50 border-orange-300 text-orange-700 font-medium'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Follow</span>
          </button>
        </div>
      </div>

      {/* Full-Screen Leaflet Map Canvas */}
      <div className="w-full h-full absolute inset-0 z-0">
        <MapContainer
          center={currentPos}
          zoom={18}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution="&copy; Google Maps Satellite"
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            maxZoom={20}
          />

          <MapRecenterController center={currentPos} autoFollow={autoFollow} />

          {/* Survey Breadcrumb Trail */}
          {polylineCoords.length > 1 && (
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#ea580c',
                weight: 2,
                opacity: 0.6,
                dashArray: '2, 4'
              }}
            />
          )}

          {/* Layer 1: Smooth Continuous Gaussian Heatmap Layer (Always Active) */}
          <SmoothHeatmapLayer points={displayedHistory} visible={true} />

          {/* Layer 2: Interactive Measurement Pins Centered on Actual Waypoints */}
          {displayedHistory.map((pt, idx) => {
            const prob = pt.fireRisk?.probability ?? (pt.fireRisk?.index ? pt.fireRisk.index / 100 : 0);
            const probPercent = Math.round(prob * 100);
            const isAnomaly = prob >= 0.50 || pt.fireRisk?.isAnomalyCandidate;
            const color = getProbabilityColor(prob);
            const isSelected = selectedPoint?.id === pt.id;

            return (
              <CircleMarker
                key={pt.id || idx}
                center={[pt.gps.lat, pt.gps.lng]}
                radius={isSelected ? 6 : isAnomaly ? 4 : 2}
                pathOptions={{
                  fillColor: '#ffffff',
                  fillOpacity: isSelected ? 1.0 : isAnomaly ? 0.95 : 0.6,
                  color: isSelected ? '#000000' : color,
                  weight: isSelected ? 2.5 : 1.2
                }}
                eventHandlers={{
                  click: () => onSelectPoint(pt)
                }}
              >
                <Popup>
                  <div className="p-1 text-slate-800 min-w-[220px]">
                    <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-200">
                      <span className="font-bold text-xs text-amber-700">
                        Survey Point #{idx + 1}
                      </span>
                      <span className="text-[10px] text-slate-500 ">
                        {new Date(pt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Smoldering Probability Badge */}
                    <div className={`p-1.5 rounded-lg mb-2 flex items-center justify-between ${
                      isAnomaly 
                        ? 'bg-rose-50 border border-rose-200 text-rose-900' 
                        : 'bg-slate-50 border border-slate-200 text-slate-700'
                    }`}>
                      <div className="text-xs font-bold">
                        <span>{isAnomaly ? 'Anomaly Candidate' : 'Normal Peat Reading'}</span>
                      </div>
                      <span className=" font-extrabold text-sm" style={{ color }}>
                        {probPercent}%
                      </span>
                    </div>

                    <div className="text-xs space-y-1 my-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">ZE07-CO Gas:</span>
                        <span className="font-bold " style={{ color }}>
                          {pt.mq7?.coPpm?.toFixed(1) || 0} PPM
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">MLX Peak Temp:</span>
                        <span className="font-bold  text-rose-600">
                          {pt.mlx90640?.max?.toFixed(1) || 0}°C
                        </span>
                      </div>
                      {pt.fireRisk?.fusion && (
                        <div className="flex justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1 mt-1 ">
                          <span>CNN: {pt.fireRisk.fusion.cnnThermalScore}</span>
                          <span>LSTM: {pt.fireRisk.fusion.lstmCoScore}</span>
                          <span>Gate α: {pt.fireRisk.fusion.gateWeight}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-center text-[10px] text-amber-800 font-semibold bg-amber-50 border border-amber-200 py-0.5 rounded">
                      {isSelected ? 'Active Viewport Target' : 'Click to inspect in Camera & Trends'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Live Field Node Pulse Marker */}
          <Marker position={currentPos} icon={liveIcon}>
            <Popup>
              <div className="p-1 text-xs text-slate-800">
                <p className="font-bold text-rose-600">UnderFire Survey Node</p>
                <p className="text-slate-600 ">Lat: {currentPos[0]?.toFixed(5)}</p>
                <p className="text-slate-600 ">Lng: {currentPos[1]?.toFixed(5)}</p>
                <p className="text-emerald-700">Patrol Speed: <span className="">{latestGps?.speedKmh || 0}</span> km/h</p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Heatmap Continuous Probability Legend */}
        <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-2.5 text-[10px] shadow-lg z-[400] flex flex-col gap-1.5 text-slate-700 pointer-events-auto min-w-[220px]">
          <div className="font-bold text-slate-800 uppercase tracking-wider text-xs">
            Smoldering Probability
          </div>
          
          {/* Continuous Gradient Bar */}
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-600 shadow-inner" />
          
          <div className="flex justify-between text-[9px] text-slate-500 font-medium">
            <span>0% (Safe)</span>
            <span>50% (Anomaly)</span>
            <span>100% (Critical)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

