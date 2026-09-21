import React from 'react';

export default function DeviceStatusCard({ latestData }) {
  const gps = latestData?.gps || { satellites: 0, fix: false, speedKmh: 0, altitude: 0 };
  const battery = latestData?.battery || { voltage: 3.7, percentage: 50 };
  const lora = latestData?.lora || { rssi: -85, snr: 7.2, frequency: 915.0, spreadingFactor: "SF9", gatewayId: "GW-PEAT-01" };
  const fireRisk = latestData?.fireRisk || { index: 15, level: "LOW RISK" };

  // LoRa RF Link Quality calculation
  const getLoraQuality = (rssi, snr) => {
    if (rssi > -80 && snr > 5) return { label: 'Excellent Link', color: 'text-emerald-400', bars: 4 };
    if (rssi > -95 && snr > 0) return { label: 'Good Link', color: 'text-cyan-400', bars: 3 };
    if (rssi > -110 && snr > -10) return { label: 'Fair Link', color: 'text-amber-400', bars: 2 };
    return { label: 'Weak / Fringe', color: 'text-rose-400', bars: 1 };
  };

  const loraQuality = getLoraQuality(lora.rssi, lora.snr);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 gap-2">
        <h2 className="text-sm font-semibold text-slate-800 truncate">Hardware Diagnostics</h2>

        {/* Peat Fire Index Badge */}
        <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 flex-shrink-0">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Risk: <span className={fireRisk.index > 50 ? 'text-rose-600' : 'text-emerald-700'}>{fireRisk.index}/100</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* LoRa RF Link Quality */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-[11px] font-medium text-slate-700 truncate">LoRa RF Signal</span>
            <span className={`text-[10px] font-bold flex-shrink-0 ${loraQuality.color.replace('400', '600')}`}>{loraQuality.label}</span>
          </div>
          <div>
            <span className="text-base font-bold text-slate-900">{lora.rssi}</span>
            <span className="text-slate-500 text-[10px] ml-1">dBm</span>
          </div>
          <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-500">
            <span className="truncate">SNR: {lora.snr}dB • {lora.spreadingFactor}</span>
            <div className="flex gap-0.5 items-end h-2 flex-shrink-0 ml-1">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`w-1.5 rounded-sm ${
                    bar <= loraQuality.bars ? 'bg-cyan-600' : 'bg-slate-200'
                  }`}
                  style={{ height: `${bar * 25}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* GPS Satellite Lock */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-[11px] font-medium text-slate-700 truncate">Peatland GPS</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${gps.fix ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
          <div>
            <span className="text-base font-bold  text-slate-900">{gps.satellites}</span>
            <span className="text-slate-500 text-[10px] ml-1">Satellites</span>
          </div>
          <p className="text-[10px] text-slate-500  mt-1 truncate">
            Alt: {gps.altitude}m • {gps.speedKmh} km/h
          </p>
        </div>

        {/* LiPo Battery Level */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 gap-1">
            <span className="text-[11px] font-medium text-slate-700 truncate">Field LiPo Cell</span>
            <span className=" text-[10px] text-slate-500 flex-shrink-0">{battery.voltage}V</span>
          </div>
          <div>
            <span className="text-base font-bold  text-emerald-700">{battery.percentage}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${battery.percentage}%` }}
            />
          </div>
        </div>

        {/* Node Device ID */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium text-slate-700 truncate">Field Node ID</span>
          </div>
          <div>
            <span className="text-xs font-bold  text-amber-800 truncate block">
              {latestData?.deviceId || 'LORA-PEAT-NODE-01'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500  mt-1 truncate">
            {latestData?.timestamp ? new Date(latestData.timestamp).toLocaleTimeString() : 'Awaiting sync'}
          </p>
        </div>
      </div>
    </div>
  );
}
