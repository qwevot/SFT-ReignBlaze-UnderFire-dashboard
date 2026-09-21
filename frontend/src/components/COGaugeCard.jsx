import React from 'react';
import { Wind, AlertTriangle, CheckCircle2, ShieldAlert, Flame } from 'lucide-react';

export default function COGaugeCard({ mq7Data }) {
  const coPpm = mq7Data?.coPpm ?? 12.0;
  const rawAdc = mq7Data?.rawAdc ?? 450;
  const status = mq7Data?.status ?? 'SAFE';
  const hazardWarning = mq7Data?.hazardWarning;

  // Percentage on 0-250 ppm scale
  const percentage = Math.min(100, Math.max(0, (coPpm / 250) * 100));

  const statusConfig = {
    SAFE: {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      barColor: 'from-emerald-500 to-teal-400',
      label: 'AMBIENT / NORMAL',
      icon: CheckCircle2,
      desc: 'No smoldering emissions detected (<35 PPM)'
    },
    WARNING: {
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      barColor: 'from-amber-500 to-orange-400',
      label: 'ELEVATED SMOLDERING RISK',
      icon: AlertTriangle,
      desc: 'Moderate CO plume detected (35 - 100 PPM). Peat embers possible.'
    },
    DANGER: {
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      barColor: 'from-rose-500 to-red-600',
      label: 'CRITICAL PEAT COMBUSTION',
      icon: ShieldAlert,
      desc: 'Severe subterranean smoldering (>100 PPM). High toxic hazard.'
    }
  };

  const currentStatus = statusConfig[status] || statusConfig.SAFE;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">ZE07-CO Gas Sensor</h2>
          </div>
        </div>

        {/* Status Pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${currentStatus.bgColor} ${currentStatus.color} ${currentStatus.borderColor}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{status}</span>
        </div>
      </div>

      {/* Main PPM Display */}
      <div className="py-4 my-auto">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">CO Concentration</span>
          <span className="text-xs text-slate-500 ">ADC: {rawAdc}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-extrabold  tracking-tight ${currentStatus.color}`}>
            {coPpm.toFixed(1)}
          </span>
          <span className="text-sm font-bold text-slate-400">PPM</span>
        </div>

        {hazardWarning && (
          <div className="mt-2 text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded px-2.5 py-1.5 flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
            <span>Peat Hotspot: <strong>{hazardWarning}</strong></span>
          </div>
        )}
      </div>

      {/* Threshold Meter Bar */}
      <div>
        <div className="flex justify-between text-[10px]  text-slate-400 mb-1">
          <span>0 PPM</span>
          <span className="text-amber-400 font-bold">35 PPM</span>
          <span className="text-rose-400 font-bold">100 PPM</span>
          <span>250+ PPM</span>
        </div>

        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 relative border border-slate-700">
          <div className="absolute top-0 bottom-0 left-[14%] w-0.5 bg-amber-400/60 z-10" />
          <div className="absolute top-0 bottom-0 left-[40%] w-0.5 bg-rose-400/60 z-10" />
          
          <div
            className={`h-full rounded-full bg-gradient-to-r ${currentStatus.barColor} transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
