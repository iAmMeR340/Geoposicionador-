import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceDot, 
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { Soldier, BreadcrumbPoint } from '../types';
import { Mountain, ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, Crosshair, Compass } from 'lucide-react';

interface TerrainElevationProfileProps {
  soldier: Soldier;
  onHoverPoint?: (point: { lat: number; lng: number; altitude: number } | null) => void;
  onClickPoint?: (point: { lat: number; lng: number }) => void;
}

interface ElevationDataPoint {
  index: number;
  distanceMeters: number;
  distanceFormatted: string;
  altitude: number;
  lat: number;
  lng: number;
  hr: number;
  spo2: number;
  slope: number;
  isPeak: boolean;
  isValley: boolean;
}

export const TerrainElevationProfile: React.FC<TerrainElevationProfileProps> = ({
  soldier,
  onHoverPoint,
  onClickPoint,
}) => {
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  // Calculate cumulative distance and elevation profile along soldier's route history
  const { profileData, minAlt, maxAlt, peakPoint, valleyPoint, totalAscent, totalDescent, maxSlope } = useMemo(() => {
    const rawPoints = soldier.routeHistory && soldier.routeHistory.length > 0 
      ? soldier.routeHistory 
      : [{ lat: soldier.location.lat, lng: soldier.location.lng, hr: soldier.vitals.heartRate, spo2: soldier.vitals.oxygenSaturation, timestamp: '00:00:00' }];

    let cumDistance = 0;
    let min = Infinity;
    let max = -Infinity;
    let peakIdx = 0;
    let valleyIdx = 0;
    let ascent = 0;
    let descent = 0;
    let maxS = 0;

    let prevAlt: number | null = null;
    let prevDistanceMeters = 0;

    const data: ElevationDataPoint[] = [];

    rawPoints.forEach((pt, idx) => {
      if (idx > 0) {
        const prev = rawPoints[idx - 1];
        // Approximate distance in meters between consecutive GPS coordinates
        const R = 6371e3;
        const φ1 = (prev.lat * Math.PI) / 180;
        const φ2 = (pt.lat * Math.PI) / 180;
        const Δφ = ((pt.lat - prev.lat) * Math.PI) / 180;
        const Δλ = ((pt.lng - prev.lng) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const segDist = R * c;
        cumDistance += segDist;
      }

      // Generate continuous topographic altitude variation if no raw altitude logged
      let alt = pt.altitude !== undefined ? pt.altitude : soldier.location.altitude;
      if (pt.altitude === undefined) {
        // Natural terrain topography wave simulation based on coordinate hashes
        const wave1 = Math.sin(pt.lat * 800 + pt.lng * 400) * 45;
        const wave2 = Math.cos(pt.lng * 1200 - pt.lat * 600) * 25;
        const wave3 = Math.sin((idx / (rawPoints.length || 1)) * Math.PI * 2) * 35;
        alt = Math.max(12, Math.round(soldier.location.altitude + wave1 + wave2 + wave3));
      }

      if (alt > max) {
        max = alt;
        peakIdx = idx;
      }
      if (alt < min) {
        min = alt;
        valleyIdx = idx;
      }

      // Slope calculation (%)
      let slope = 0;
      if (idx > 0 && prevAlt !== null) {
        const run = cumDistance - prevDistanceMeters;
        const rise = alt - prevAlt;
        if (rise > 0) ascent += rise;
        else descent += Math.abs(rise);
        
        if (run > 0.1) {
          slope = Math.min(60, Math.max(-60, Number(((rise / run) * 100).toFixed(1))));
          if (Math.abs(slope) > Math.abs(maxS)) {
            maxS = slope;
          }
        }
      }

      prevAlt = alt;
      prevDistanceMeters = cumDistance;

      data.push({
        index: idx,
        distanceMeters: Math.round(cumDistance),
        distanceFormatted: cumDistance >= 1000 ? `${(cumDistance / 1000).toFixed(2)} km` : `${Math.round(cumDistance)} m`,
        altitude: alt,
        lat: pt.lat,
        lng: pt.lng,
        hr: pt.hr,
        spo2: pt.spo2,
        slope,
        isPeak: false,
        isValley: false,
      });
    });

    if (data[peakIdx]) data[peakIdx].isPeak = true;
    if (data[valleyIdx]) data[valleyIdx].isValley = true;

    return {
      profileData: data,
      minAlt: min === Infinity ? 0 : min,
      maxAlt: max === -Infinity ? 100 : max,
      peakPoint: data[peakIdx] || null,
      valleyPoint: data[valleyIdx] || null,
      totalAscent: Math.round(ascent),
      totalDescent: Math.round(descent),
      maxSlope: Math.round(maxS),
    };
  }, [soldier]);

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono-military text-slate-100 shadow-xl space-y-3" id="terrain-elevation-profile-card">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 tracking-wider uppercase font-tactical flex items-center gap-2">
              PERFIL TOPOGRÁFICO DE ELEVACIÓN DE RUTA
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono-military">
                {soldier.callsign}
              </span>
            </h3>
            <p className="text-[9.5px] text-slate-400">
              Análisis Geodésico de Cota, Pendientes y Puntos Críticos de Terreno
            </p>
          </div>
        </div>

        {/* Quick Elevation Stats Badges */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-400">COTA MÁXIMA:</span>
            <span className="text-emerald-400 font-bold">{maxAlt} m</span>
          </div>

          <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-400">DESNIVEL (+):</span>
            <span className="text-cyan-400 font-bold">+{totalAscent} m</span>
          </div>

          <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-400">PENDIENTE MÁX:</span>
            <span className={`${Math.abs(maxSlope) > 25 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
              {maxSlope}%
            </span>
          </div>
        </div>
      </div>

      {/* Critical Height Highlights Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        {/* Peak Critical Point */}
        <div 
          onClick={() => peakPoint && onClickPoint && onClickPoint({ lat: peakPoint.lat, lng: peakPoint.lng })}
          className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-400 cursor-pointer transition-colors flex items-center justify-between"
          title="Haga clic para centrar en la Cota Máxima de Terreno"
        >
          <div>
            <span className="text-[9px] text-emerald-400 uppercase font-bold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              Punto de Cresta (Peak)
            </span>
            <p className="text-sm font-bold text-slate-100 mt-0.5">{maxAlt} metros</p>
            <p className="text-[8.5px] text-slate-400">Ventaja Táctica de Observación</p>
          </div>
          <Crosshair className="w-4 h-4 text-emerald-400 opacity-60 hover:opacity-100" />
        </div>

        {/* Valley Critical Point */}
        <div 
          onClick={() => valleyPoint && onClickPoint && onClickPoint({ lat: valleyPoint.lat, lng: valleyPoint.lng })}
          className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors flex items-center justify-between"
          title="Haga clic para centrar en el Punto Mínimo de Terreno"
        >
          <div>
            <span className="text-[9px] text-cyan-400 uppercase font-bold flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-cyan-400" />
              Depresión / Vaguada
            </span>
            <p className="text-sm font-bold text-slate-100 mt-0.5">{minAlt} metros</p>
            <p className="text-[8.5px] text-slate-400">Riesgo de Encajonamiento</p>
          </div>
          <Crosshair className="w-4 h-4 text-cyan-400 opacity-60 hover:opacity-100" />
        </div>

        {/* Ascent Accumulated */}
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-amber-400 uppercase font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              Ascenso Acumulado
            </span>
            <p className="text-sm font-bold text-slate-100 mt-0.5">+{totalAscent} m</p>
            <p className="text-[8.5px] text-slate-400">Gasto Metabólico Operativo</p>
          </div>
        </div>

        {/* Slope Warning */}
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-rose-400 uppercase font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              Gradiente Terreno
            </span>
            <p className="text-sm font-bold text-slate-100 mt-0.5">{maxSlope}% pend.</p>
            <p className="text-[8.5px] text-slate-400">Tránsito a Pie de Escuadra</p>
          </div>
        </div>
      </div>

      {/* Recharts Topographic Profile Chart */}
      <div className="h-44 sm:h-56 lg:h-64 w-full bg-slate-950 p-2 rounded-lg border border-slate-850 pt-3 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={profileData}
            margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
            onMouseMove={(state) => {
              if (state && state.activeTooltipIndex !== undefined && profileData[state.activeTooltipIndex]) {
                const pt = profileData[state.activeTooltipIndex];
                setActiveHoverIndex(state.activeTooltipIndex);
                if (onHoverPoint) {
                  onHoverPoint({ lat: pt.lat, lng: pt.lng, altitude: pt.altitude });
                }
              }
            }}
            onMouseLeave={() => {
              setActiveHoverIndex(null);
              if (onHoverPoint) onHoverPoint(null);
            }}
            onClick={(state) => {
              if (state && state.activeTooltipIndex !== undefined && profileData[state.activeTooltipIndex]) {
                const pt = profileData[state.activeTooltipIndex];
                if (onClickPoint) onClickPoint({ lat: pt.lat, lng: pt.lng });
              }
            }}
          >
            <defs>
              <linearGradient id="terrainElevationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="60%" stopColor="#0284c7" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0f172a" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            
            <XAxis 
              dataKey="distanceFormatted" 
              stroke="#64748b" 
              fontSize={9} 
              tickLine={false}
            />
            
            <YAxis 
              stroke="#64748b" 
              fontSize={9} 
              domain={['dataMin - 10', 'dataMax + 20']} 
              unit="m"
              tickLine={false}
            />

            <Tooltip 
              content={<CustomElevationTooltip />} 
            />

            {/* Peak Reference Dot */}
            {peakPoint && (
              <ReferenceDot 
                x={peakPoint.distanceFormatted} 
                y={peakPoint.altitude} 
                r={5} 
                fill="#10b981" 
                stroke="#ffffff" 
                strokeWidth={2}
              />
            )}

            {/* Valley Reference Dot */}
            {valleyPoint && (
              <ReferenceDot 
                x={valleyPoint.distanceFormatted} 
                y={valleyPoint.altitude} 
                r={4} 
                fill="#38bdf8" 
                stroke="#ffffff" 
                strokeWidth={1.5}
              />
            )}

            <Area 
              type="monotone" 
              dataKey="altitude" 
              stroke="#10b981" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#terrainElevationGradient)" 
              activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Instruction footer notice */}
        <p className="text-[8.5px] text-slate-500 text-center italic mt-1">
          Deslice el cursor sobre la gráfica para proyectar la retícula de posición en el mapa táctico.
        </p>
      </div>
    </div>
  );
};

// Custom Tooltip for Elevation Chart
const CustomElevationTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data: ElevationDataPoint = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-emerald-500/60 p-2.5 rounded-lg shadow-2xl text-slate-100 font-mono-military text-[10px] space-y-1 min-w-44 z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
          <span className="font-bold text-emerald-400">DISTANCIA: {data.distanceFormatted}</span>
          <span className="text-[9px] text-slate-400">Punto #{data.index + 1}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">ALTITUD TERRENO:</span>
          <span className="font-bold text-emerald-300">{data.altitude} m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">PENDIENTE LOCAL:</span>
          <span className={`font-bold ${Math.abs(data.slope) > 20 ? 'text-amber-400' : 'text-slate-200'}`}>
            {data.slope > 0 ? `+${data.slope}%` : `${data.slope}%`}
          </span>
        </div>
        <div className="flex justify-between border-t border-slate-850 pt-1 mt-1 text-[9px]">
          <span className="text-slate-400">SIGNO VITAL (PULSO):</span>
          <span className="text-rose-400 font-bold">{data.hr} BPM</span>
        </div>
      </div>
    );
  }
  return null;
};
