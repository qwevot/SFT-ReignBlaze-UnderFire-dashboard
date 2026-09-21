import React, { useRef, useEffect, useState } from 'react';

const PALETTES = {
  ironbow: (t) => {
    if (t < 0.25) {
      const k = t / 0.25;
      return [Math.round(20 + 30 * k), Math.round(10 + 10 * k), Math.round(80 + 100 * k)];
    } else if (t < 0.5) {
      const k = (t - 0.25) / 0.25;
      return [Math.round(50 + 150 * k), Math.round(20 + 10 * k), Math.round(180 - 80 * k)];
    } else if (t < 0.75) {
      const k = (t - 0.5) / 0.25;
      return [Math.round(200 + 45 * k), Math.round(30 + 140 * k), Math.round(100 - 80 * k)];
    } else {
      const k = (t - 0.75) / 0.25;
      return [Math.round(245 + 10 * k), Math.round(170 + 85 * k), Math.round(20 + 200 * k)];
    }
  },
  inferno: (t) => {
    if (t < 0.3) {
      const k = t / 0.3;
      return [Math.round(150 * k), 0, Math.round(60 * k)];
    } else if (t < 0.7) {
      const k = (t - 0.3) / 0.4;
      return [Math.round(150 + 105 * k), Math.round(140 * k), 0];
    } else {
      const k = (t - 0.7) / 0.3;
      return [255, Math.round(140 + 115 * k), Math.round(200 * k)];
    }
  },
  jet: (t) => {
    const r = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 3))) * 255;
    const g = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 2))) * 255;
    const b = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 1))) * 255;
    return [Math.round(r), Math.round(g), Math.round(b)];
  },
  grayscale: (t) => {
    const v = Math.round(t * 255);
    return [v, v, v];
  }
};

export default function ThermalViewer({ 
  thermalData, 
  title = "MLX90640 Thermal IR Camera",
  selectedPoint = null,
  pointIndex = -1,
  onClearSelection
}) {
  const canvasRef = useRef(null);
  const [palette, setPalette] = useState('inferno');
  const [hoverTemp, setHoverTemp] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);

  const rows = thermalData?.rows || 24;
  const cols = thermalData?.cols || 32;
  const pixels = thermalData?.pixels || [];

  const minTemp = thermalData?.min ?? 26.0;
  const maxTemp = thermalData?.max ?? 48.0;
  const avgTemp = thermalData?.avg ?? 29.5;
  const centerTemp = thermalData?.center ?? 28.0;

  // Find hotspot coordinates for crosshair highlight
  let maxCol = 16, maxRow = 12;
  if (pixels.length === rows * cols) {
    let highest = -999;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = pixels[r * cols + c];
        if (val > highest) {
          highest = val;
          maxCol = c;
          maxRow = r;
        }
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pixels.length !== rows * cols) return;

    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(cols, rows);

    const range = Math.max(1, maxTemp - minTemp);
    const colorFn = PALETTES[palette] || PALETTES.inferno;

    for (let i = 0; i < pixels.length; i++) {
      const temp = pixels[i];
      const norm = Math.max(0, Math.min(1, (temp - minTemp) / range));
      const [r, g, b] = colorFn(norm);

      const offset = i * 4;
      imgData.data[offset] = r;
      imgData.data[offset + 1] = g;
      imgData.data[offset + 2] = b;
      imgData.data[offset + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [pixels, rows, cols, minTemp, maxTemp, palette]);

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || pixels.length !== rows * cols) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * cols);
    const row = Math.floor((y / rect.height) * rows);

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      const temp = pixels[row * cols + col];
      setHoverTemp(temp);
      setHoverPos({ x, y, row, col });
    }
  };

  const handleMouseLeave = () => {
    setHoverTemp(null);
    setHoverPos(null);
  };

  const isHotspotCritical = maxTemp >= 60;
  const fusion = selectedPoint?.fireRisk?.fusion;
  const prob = selectedPoint?.fireRisk?.probability ?? (selectedPoint?.fireRisk?.index ? selectedPoint.fireRisk.index / 100 : null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
      {/* Header & Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {selectedPoint && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Waypoint #{pointIndex >= 0 ? pointIndex + 1 : 'Selected'}
              </span>
              {onClearSelection && (
                <button
                  onClick={onClearSelection}
                  title="Deselect waypoint"
                  className="text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded transition-colors font-bold leading-none"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">

          <select
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            className="text-xs bg-slate-100 border border-slate-200 text-slate-700 rounded px-2 py-1 outline-none focus:border-cyan-500 font-medium cursor-pointer"
          >
            <option value="inferno">Inferno (Thermal)</option>
            <option value="ironbow">Ironbow</option>
            <option value="jet">Jet / Rainbow</option>
            <option value="grayscale">Grayscale</option>
          </select>
        </div>
      </div>

      {/* Main Thermal Canvas View - Exact 32x24 MLX90640 Native Resolution */}
      <div className="relative w-full aspect-[4/3] max-h-[280px] rounded-lg overflow-hidden bg-black border border-slate-200 flex items-center justify-center group mx-auto">
        <canvas
          ref={canvasRef}
          width={32}
          height={24}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full [image-rendering:pixelated] cursor-crosshair"
        />

        {/* Center Target Marker */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="w-4 h-4 border border-white/60 rounded-full" />
            <span className="absolute left-6  text-[11px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded border border-white/20 whitespace-nowrap">
              Ground: {centerTemp.toFixed(1)}°C
            </span>
          </div>
        </div>

        {/* Hotspot Target Crosshair */}
        <div 
          className="absolute pointer-events-none transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${((maxCol + 0.5) / cols) * 100}%`,
            top: `${((maxRow + 0.5) / rows) * 100}%`,
          }}
        >
          <div className="relative flex items-center justify-center">
            <div className={`w-5 h-5 rounded-full border-2 ${isHotspotCritical ? 'border-rose-400 animate-ping' : 'border-amber-400'} absolute`} />
            <div className={`w-2.5 h-2.5 ${isHotspotCritical ? 'bg-rose-500 ring-rose-400' : 'bg-amber-500 ring-amber-400'} rounded-full ring-2 shadow-lg`} />
            <span className={`absolute -top-6  text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              isHotspotCritical 
                ? 'text-rose-200 bg-rose-950/90 border-rose-500/50 animate-pulse' 
                : 'text-amber-200 bg-amber-950/90 border-amber-500/50'
            }`}>
              SMOLDERING {maxTemp.toFixed(1)}°C
            </span>
          </div>
        </div>

        {/* Cursor Hover Tooltip */}
        {hoverTemp !== null && hoverPos && (
          <div
            className="absolute pointer-events-none bg-slate-900/90 text-white text-[11px]  px-2 py-1 rounded shadow-lg border border-slate-700 z-10 transform -translate-x-1/2 -translate-y-9"
            style={{ left: hoverPos.x, top: hoverPos.y }}
          >
            {hoverTemp.toFixed(1)}°C <span className="text-slate-400">[{hoverPos.col},{hoverPos.row}]</span>
          </div>
        )}

        {/* Colormap Legend Bar */}
        <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded border border-white/10 flex items-center justify-between text-[10px]  text-slate-300">
          <span>{minTemp.toFixed(1)}°C</span>
          <div className="h-1.5 flex-1 mx-3 rounded-full bg-gradient-to-r from-indigo-950 via-amber-600 to-rose-400" />
          <span>{maxTemp.toFixed(1)}°C</span>
        </div>
      </div>

      {/* Selected Point Multimodal Fusion Strip (if inspecting a waypoint) */}
      {selectedPoint && (
        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs  grid grid-cols-2 gap-2 text-center">
          <div className="bg-white/80 p-1.5 rounded border border-slate-200/60">
            <span className="text-[10px] text-slate-500 block uppercase">CO Reading</span>
            <span className="font-bold text-cyan-600">{selectedPoint.mq7?.coPpm?.toFixed(1) || 0} PPM</span>
          </div>
          <div className="bg-white/80 p-1.5 rounded border border-slate-200/60">
            <span className="text-[10px] text-slate-500 block uppercase">CNN Thermal</span>
            <span className="font-bold text-rose-600">{fusion?.cnnThermalScore ?? (maxTemp > 45 ? 0.82 : 0.15)}</span>
          </div>
          <div className="bg-white/80 p-1.5 rounded border border-slate-200/60">
            <span className="text-[10px] text-slate-500 block uppercase">LSTM CO</span>
            <span className="font-bold text-orange-600">{fusion?.lstmCoScore ?? (selectedPoint.mq7?.coPpm > 35 ? 0.78 : 0.12)}</span>
          </div>
          <div className="bg-white/80 p-1.5 rounded border border-slate-200/60">
            <span className="text-[10px] text-slate-500 block uppercase">Risk Probability</span>
            <span className="font-bold text-amber-700">{prob !== null ? `${Math.round(prob * 100)}%` : '--'}</span>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200 text-center">
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Soil Min</p>
          <p className="text-xs font-bold  text-cyan-600">{minTemp.toFixed(1)}°C</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Soil Avg</p>
          <p className="text-xs font-bold  text-emerald-600">{avgTemp.toFixed(1)}°C</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Center</p>
          <p className="text-xs font-bold  text-amber-600">{centerTemp.toFixed(1)}°C</p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Peak Hotspot</p>
          <p className={`text-xs font-bold  ${isHotspotCritical ? 'text-rose-600 animate-pulse' : 'text-orange-600'}`}>
            {maxTemp.toFixed(1)}°C
          </p>
        </div>
      </div>
    </div>
  );
}
