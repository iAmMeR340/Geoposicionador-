import React, { useState, useMemo } from 'react';
import { Soldier } from '../types';
import { 
  Heart, 
  Wind, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles, 
  Maximize2, 
  Filter, 
  SlidersHorizontal,
  Flame,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine,
  Legend
} from 'recharts';

interface BiometricTrendChartProps {
  soldier: Soldier;
  timeframeHours?: number;
}

export const BiometricTrendChart: React.FC<BiometricTrendChartProps> = ({
  soldier,
  timeframeHours = 12,
}) => {
  const [selectedRange, setSelectedRange] = useState<3 | 6 | 12>(12);
  const [activeMetric, setActiveMetric] = useState<'ALL' | 'HR' | 'SPO2'>('ALL');

  // Generate continuous 12-hour biometric data points for the selected soldier
  const trendData = useMemo(() => {
    if (!soldier) return [];

    const now = new Date();
    const totalPoints = 24; // 24 data points over 12 hours (every 30 minutes)
    const points: Array<{
      time: string;
      fullTime: string;
      hourAgo: number;
      heartRate: number;
      spo2: number;
      temp: number;
      stress: 'BAJO' | 'MODERADO' | 'ELEVADO' | 'CRÍTICO';
      isCurrent: boolean;
    }> = [];

    const currentHR = soldier.vitals.heartRate;
    const currentSpO2 = soldier.vitals.oxygenSaturation;
    const history = soldier.routeHistory || [];

    for (let i = totalPoints - 1; i >= 0; i--) {
      const pointDate = new Date(now.getTime() - i * 30 * 60 * 1000);
      const hourAgo = Number((i * 0.5).toFixed(1));

      const timeStr = `${String(pointDate.getHours()).padStart(2, '0')}:${String(pointDate.getMinutes()).padStart(2, '0')}`;
      const fullTimeStr = `${timeStr} ZULU (-${hourAgo}h)`;

      // Generate realistic physiological fluctuations anchored to soldier's actual vitals
      let hr = currentHR;
      let spo2 = currentSpO2;

      // Map from routeHistory if available for recent hours
      if (history.length > 0 && i < history.length) {
        const histPoint = history[history.length - 1 - i];
        if (histPoint) {
          hr = histPoint.hr || hr;
          spo2 = histPoint.spo2 || spo2;
        }
      } else {
        // Exertion cycles (patrols, tactical movement, resting periods)
        const wave1 = Math.sin(i * 0.6) * 18;
        const wave2 = Math.cos(i * 0.3) * 10;
        const noise = (Math.random() - 0.5) * 6;

        hr = Math.min(180, Math.max(55, Math.round(currentHR + wave1 + wave2 + noise)));
        
        // Inverse correlation for SpO2 during high exertion
        const spo2Drop = hr > 140 ? (hr - 140) * 0.15 : 0;
        spo2 = Math.min(100, Math.max(88, Number((currentSpO2 - spo2Drop + Math.sin(i) * 0.8).toFixed(1))));
      }

      // Final point is exact current vitals
      if (i === 0) {
        hr = currentHR;
        spo2 = currentSpO2;
      }

      let stress: 'BAJO' | 'MODERADO' | 'ELEVADO' | 'CRÍTICO' = 'BAJO';
      if (hr >= 150 || spo2 <= 91) stress = 'CRÍTICO';
      else if (hr >= 130 || spo2 <= 93) stress = 'ELEVADO';
      else if (hr >= 105) stress = 'MODERADO';

      points.push({
        time: timeStr,
        fullTime: fullTimeStr,
        hourAgo,
        heartRate: hr,
        spo2,
        temp: Number((soldier.vitals.temperature + (Math.sin(i) * 0.2)).toFixed(1)),
        stress,
        isCurrent: i === 0,
      });
    }

    // Filter points based on selected range (3h, 6h, 12h)
    return points.filter(p => p.hourAgo <= selectedRange);
  }, [soldier, selectedRange]);

  // Compute 12-hour Summary Statistics
  const stats = useMemo(() => {
    if (trendData.length === 0) return { minHR: 0, maxHR: 0, avgHR: 0, minSpO2: 100, maxSpO2: 100, avgSpO2: 100 };

    const hrs = trendData.map(d => d.heartRate);
    const spo2s = trendData.map(d => d.spo2);

    return {
      minHR: Math.min(...hrs),
      maxHR: Math.max(...hrs),
      avgHR: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
      minSpO2: Math.min(...spo2s),
      maxSpO2: Math.max(...spo2s),
      avgSpO2: Number((spo2s.reduce((a, b) => a + b, 0) / spo2s.length).toFixed(1)),
    };
  }, [trendData]);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-2xl space-y-4 sm:space-y-6 text-slate-100">
      
      {/* HEADER BAR: TITLE & RESPONSIVE METRIC CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-500/40 shadow-lg shadow-sky-950/40">
            <Activity className="w-5 h-5 text-sky-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-tactical font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2 flex-wrap">
              Tendencia Biométrica Táctica ({selectedRange} Horas)
              <span className="text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full">
                {soldier.callsign}
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Fluctuaciones continuas de Frecuencia Cardíaca (BPM) y Oximetría ($SpO_2$) con análisis de estrés.
            </p>
          </div>
        </div>

        {/* RESPONSIVE TIMEFRAME & METRIC TOGGLES */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          
          {/* Metric Selector (ALL / HR / SPO2) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => setActiveMetric('ALL')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeMetric === 'ALL' ? 'bg-sky-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ambos
            </button>
            <button
              onClick={() => setActiveMetric('HR')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeMetric === 'HR' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              FC (BPM)
            </button>
            <button
              onClick={() => setActiveMetric('SPO2')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeMetric === 'SPO2' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-sky-300'
              }`}
            >
              $SpO_2$ (%)
            </button>
          </div>

          {/* Timeframe Selector (3h / 6h / 12h) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
            {[3, 6, 12].map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range as any)}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  selectedRange === range ? 'bg-emerald-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range}h
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* SUMMARY STATS GRID (RESPONSIVE FOR MOBILE / TABLET / DESKTOP) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono">
        
        {/* Min / Max Heart Rate */}
        <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl border border-rose-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold block">FC Máxima / Mínima</span>
            <span className="text-base sm:text-xl font-bold text-rose-400">
              {stats.maxHR} <span className="text-xs text-slate-400">/ {stats.minHR} BPM</span>
            </span>
          </div>
          <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 shrink-0 opacity-80" />
        </div>

        {/* Avg Heart Rate */}
        <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold block">FC Promedio ({selectedRange}h)</span>
            <span className="text-base sm:text-xl font-bold text-amber-400">
              {stats.avgHR} <span className="text-xs text-slate-400">BPM</span>
            </span>
          </div>
          <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0 opacity-80" />
        </div>

        {/* Min / Max SpO2 */}
        <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl border border-sky-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold block">Oximetría Mín / Máx</span>
            <span className="text-base sm:text-xl font-bold text-sky-400">
              {stats.minSpO2}% <span className="text-xs text-slate-400">/ {stats.maxSpO2}%</span>
            </span>
          </div>
          <Wind className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 shrink-0 opacity-80" />
        </div>

        {/* Avg SpO2 */}
        <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold block">Oximetría Promedio</span>
            <span className="text-base sm:text-xl font-bold text-emerald-400">
              {stats.avgSpO2}%
            </span>
          </div>
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0 opacity-80" />
        </div>

      </div>

      {/* RECHARTS MAIN TREND GRAPH (RESPONSIVE HEIGHT FOR MOBILE / TABLET) */}
      <div className="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-[11px] font-mono">
          <span className="text-slate-300 font-bold uppercase flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            Curva Biométrica Continua: {soldier.rank} {soldier.name}
          </span>
          <span className="text-slate-400 hidden sm:inline">
            Umbral de Riesgo: &gt;140 BPM | &lt;92% $SpO_2$
          </span>
        </div>

        {/* Chart Container */}
        <div className="w-full h-[250px] sm:h-[320px] lg:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
              />

              {/* Left Y Axis: Heart Rate BPM */}
              {(activeMetric === 'ALL' || activeMetric === 'HR') && (
                <YAxis 
                  yAxisId="hr" 
                  domain={[40, 180]} 
                  stroke="#f43f5e" 
                  fontSize={10} 
                  unit=" BPM" 
                />
              )}

              {/* Right Y Axis: SpO2 % */}
              {(activeMetric === 'ALL' || activeMetric === 'SPO2') && (
                <YAxis 
                  yAxisId="spo2" 
                  orientation="right" 
                  domain={[85, 100]} 
                  stroke="#38bdf8" 
                  fontSize={10} 
                  unit="%" 
                />
              )}

              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-2xl font-mono text-xs text-slate-100 space-y-1">
                        <p className="font-bold text-sky-400 border-b border-slate-800 pb-1">
                          ⏱️ {data.fullTime}
                        </p>
                        <p className="text-rose-400 font-bold flex items-center justify-between gap-4">
                          <span>Frecuencia Cardíaca:</span>
                          <span>{data.heartRate} BPM</span>
                        </p>
                        <p className="text-sky-300 font-bold flex items-center justify-between gap-4">
                          <span>Saturación Oxígeno:</span>
                          <span>{data.spo2}%</span>
                        </p>
                        <p className="text-amber-400 flex items-center justify-between gap-4">
                          <span>Temperatura Corp:</span>
                          <span>{data.temp}°C</span>
                        </p>
                        <div className="pt-1 border-t border-slate-800 text-[10px] flex items-center justify-between">
                          <span className="text-slate-400">Nivel de Estrés:</span>
                          <span className={`font-bold ${
                            data.stress === 'CRÍTICO' ? 'text-red-400' : data.stress === 'ELEVADO' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {data.stress}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Critical Reference Threshold Lines */}
              <ReferenceLine yAxisId="hr" y={140} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Exer. Alto (140 BPM)', fill: '#ef4444', fontSize: 9, position: 'top' }} />
              <ReferenceLine yAxisId="spo2" y={92} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: 'Límite Hipoxia (92%)', fill: '#38bdf8', fontSize: 9, position: 'bottom' }} />

              {/* Heart Rate Area & Line */}
              {(activeMetric === 'ALL' || activeMetric === 'HR') && (
                <Area 
                  yAxisId="hr" 
                  type="monotone" 
                  dataKey="heartRate" 
                  fill="#f43f5e" 
                  fillOpacity={0.12} 
                  stroke="none" 
                />
              )}

              {(activeMetric === 'ALL' || activeMetric === 'HR') && (
                <Line 
                  yAxisId="hr" 
                  type="monotone" 
                  dataKey="heartRate" 
                  name="Frec. Cardíaca (BPM)" 
                  stroke="#f43f5e" 
                  strokeWidth={2.5} 
                  dot={{ r: 2 }} 
                  activeDot={{ r: 5, fill: '#f43f5e' }} 
                />
              )}

              {/* SpO2 Line */}
              {(activeMetric === 'ALL' || activeMetric === 'SPO2') && (
                <Line 
                  yAxisId="spo2" 
                  type="monotone" 
                  dataKey="spo2" 
                  name="Oximetría SpO2 (%)" 
                  stroke="#38bdf8" 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={{ r: 4, fill: '#38bdf8' }} 
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend Footer for Mobile & Tablet */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> FC Medida (BPM)
            </span>
            <span className="flex items-center gap-1.5 text-sky-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Oximetría $SpO_2$ (%)
            </span>
          </div>
          <span className="text-slate-500 hidden md:inline">
            Sincronización en tiempo real vía enlace E2EE SATCOM
          </span>
        </div>
      </div>

    </div>
  );
};
