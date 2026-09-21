import React from 'react';

export default function Header({ 
  latestData, 
  wsConnected, 
  simulatorActive, 
  onToggleSimulator, 
  historyCount, 
  onClearHistory 
}) {
  const isCritical = latestData?.fireRisk?.level === 'CRITICAL SMOLDERING' || (latestData?.mq7?.status === 'DANGER') || (latestData?.mlx90640?.max > 70);
  const isAnomaly = latestData?.fireRisk?.level === 'MODERATE ANOMALY';

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 px-4 lg:px-8 py-3.5 transition-colors duration-300 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 font-bold text-lg tracking-tight">
            UnderFire
          </h1>
        </div>

        {/* Real-time Status Badges & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          {/* Peat Fire Smoldering Danger Alert */}
          {isCritical ? (
            <div className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 animate-pulse font-semibold">
              <span>SMOLDERING PEAT FIRE DETECTED</span>
            </div>
          ) : isAnomaly ? (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              <span>THERMAL / CO ANOMALY</span>
            </div>
          ) : null}

          {/* Survey Waypoint Count */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
            <span><strong className=" text-slate-900">{historyCount}</strong> Waypoints</span>
          </div>

          {/* Simulator Toggle Button */}
          <button
            onClick={onToggleSimulator}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
              simulatorActive
                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Sim: {simulatorActive ? 'Running' : 'Paused'}</span>
          </button>

          {/* Clear History */}
          <button
            onClick={onClearHistory}
            title="Clear survey history"
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 transition-colors font-medium text-xs"
          >
            Clear History
          </button>
        </div>
      </div>
    </header>
  );
}
