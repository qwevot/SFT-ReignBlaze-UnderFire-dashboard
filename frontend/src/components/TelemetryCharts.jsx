import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-2.5 rounded-lg shadow-lg text-xs  text-slate-800">
        <p className="text-slate-500 mb-1">{label}</p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ color: entry.color }} className="font-bold flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span>{Number(entry.value).toFixed(1)} {entry.unit}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TelemetryCharts({ history = [], selectedPoint = null, onSelectPoint }) {
  // Format history for recharts
  const chartData = history.map((item, idx) => {
    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : `#${idx}`;
    return {
      rawItem: item,
      id: item.id,
      time: timeStr,
      coPpm: item.mq7?.coPpm || 0,
      maxTemp: item.mlx90640?.max || 0,
      avgTemp: item.mlx90640?.avg || 0
    };
  });

  const selectedTime = selectedPoint?.timestamp 
    ? new Date(selectedPoint.timestamp).toLocaleTimeString() 
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* CO Gas Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">ZE07-CO Gas Trend</h3>
            {selectedPoint && (
              <span className="text-[10px]  text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded font-semibold">
                Target: {selectedPoint.mq7?.coPpm?.toFixed(1) || 0} PPM
              </span>
            )}
          </div>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0] && onSelectPoint) {
                  onSelectPoint(e.activePayload[0].payload.rawItem);
                }
              }}
            >
              <defs>
                <linearGradient id="coGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891b2" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} tickLine={false} unit=" ppm" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="linear"
                isAnimationActive={false}
                dot={{ r: 2, fill: '#0891b2', stroke: '#0891b2' }}
                activeDot={{ r: 4 }}
                dataKey="coPpm"
                name="CO Level"
                unit="PPM"
                stroke="#0891b2"
                strokeWidth={2}
                fillOpacity={0.25}
                fill="url(#coGradient)"
              />
              {selectedTime && (
                <ReferenceLine 
                  x={selectedTime} 
                  stroke="#0891b2" 
                  strokeWidth={2} 
                  strokeDasharray="3 3"
                />
              )}
              {selectedTime && (
                <ReferenceDot
                  x={selectedTime}
                  y={selectedPoint.mq7?.coPpm || 0}
                  r={5}
                  fill="#0891b2"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Thermal IR Peak Temperature Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">MLX90640 Peak Heat Trend</h3>
            {selectedPoint && (
              <span className="text-[10px]  text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-semibold">
                Target: {selectedPoint.mlx90640?.max?.toFixed(1) || 0}°C
              </span>
            )}
          </div>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0] && onSelectPoint) {
                  onSelectPoint(e.activePayload[0].payload.rawItem);
                }
              }}
            >
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} domain={['auto', 'auto']} tickLine={false} unit="°C" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="linear"
                isAnimationActive={false}
                dot={{ r: 2, fill: '#e11d48', stroke: '#e11d48' }}
                activeDot={{ r: 4 }}
                dataKey="maxTemp"
                name="Hotspot Temp"
                unit="°C"
                stroke="#e11d48"
                strokeWidth={2}
                fillOpacity={0.25}
                fill="url(#tempGradient)"
              />
              {selectedTime && (
                <ReferenceLine 
                  x={selectedTime} 
                  stroke="#e11d48" 
                  strokeWidth={2} 
                  strokeDasharray="3 3"
                />
              )}
              {selectedTime && (
                <ReferenceDot
                  x={selectedTime}
                  y={selectedPoint.mlx90640?.max || 0}
                  r={5}
                  fill="#e11d48"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
