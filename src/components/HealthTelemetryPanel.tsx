import React, { useState, useEffect } from 'react';
import { Soldier, SoldierVitals } from '../types';
import { INITIAL_ZONES } from '../data/tacticalData';
import { FatiguePredictionPanel } from './FatiguePredictionPanel';
import { BiometricTrendChart } from './BiometricTrendChart';
import { 
  Activity, 
  Heart, 
  Thermometer, 
  Wind, 
  Zap, 
  Battery, 
  Radio, 
  ShieldAlert, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Lock,
  ArrowUpRight,
  Flame,
  Volume2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { tacticalAudio } from '../utils/audioAlerts';

interface HealthTelemetryPanelProps {
  soldiers: Soldier[];
  selectedSoldierId: string | null;
  onSelectSoldier: (id: string) => void;
  onTriggerVitalsSpike: (soldierId: string, metric: 'bpm' | 'temp' | 'spo2' | 'fall' | 'geofence') => void;
  playbackIndex?: number | null;
  onPlaybackIndexChange?: (index: number | null) => void;
}

export const HealthTelemetryPanel: React.FC<HealthTelemetryPanelProps> = ({
  soldiers,
  selectedSoldierId,
  onSelectSoldier,
  onTriggerVitalsSpike,
  playbackIndex = null,
  onPlaybackIndexChange,
}) => {
  const [subTab, setSubTab] = useState<'telemetry' | 'trend' | 'fatigue'>('telemetry');
  const [activeMetricTab, setActiveMetricTab] = useState<'all' | 'hr' | 'temp' | 'spo2'>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 4x

  const selectedSoldier = soldiers.find((s) => s.id === selectedSoldierId) || soldiers[0];

  const routeHistory = selectedSoldier?.routeHistory || [];

  // Interval hook for automatic tactical coordinate playback progression
  useEffect(() => {
    if (!isPlaying) return;
    if (routeHistory.length === 0) return;

    const interval = setInterval(() => {
      const currIdx = playbackIndex !== null ? playbackIndex : -1;
      const nextIdx = currIdx + 1;
      if (nextIdx >= routeHistory.length) {
        setIsPlaying(false);
        onPlaybackIndexChange?.(null);
      } else {
        onPlaybackIndexChange?.(nextIdx);
      }
    }, 1500 / playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, selectedSoldier, playbackIndex, playSpeed, routeHistory, onPlaybackIndexChange]);

  if (!selectedSoldier) {
    return <div className="p-8 text-center text-slate-400">No hay datos de telemetría disponibles.</div>;
  }

  // Construct chart timeline from routeHistory + current vitals
  const chartData = (selectedSoldier.routeHistory || []).map((point, index) => {
    return {
      time: point.timestamp,
      heartRate: point.hr,
      temp: Number((selectedSoldier.vitals.temperature + (Math.sin(index) * 0.3)).toFixed(1)),
      spo2: point.spo2,
      fatigue: Math.min(100, Math.max(10, Math.floor(selectedSoldier.vitals.fatigueLevel + (index * 3)))),
    };
  });

  // Ensure at least 6 points for visual rendering
  if (chartData.length < 6) {
    const baseHr = selectedSoldier.vitals.heartRate;
    const baseTemp = selectedSoldier.vitals.temperature;
    const baseSpo2 = selectedSoldier.vitals.oxygenSaturation;
    for (let i = chartData.length; i < 6; i++) {
      chartData.unshift({
        time: `14:${20 + i}`,
        heartRate: Math.max(50, baseHr - (6 - i) * 3 + Math.floor(Math.random() * 4)),
        temp: Number((baseTemp - 0.2 + (i * 0.05)).toFixed(1)),
        spo2: Math.min(100, baseSpo2 - (i % 2)),
        fatigue: Math.max(15, selectedSoldier.vitals.fatigueLevel - (6 - i) * 4),
      });
    }
  }

  // Determine vital health thresholds
  const isTachycardia = selectedSoldier.vitals.heartRate > 130;
  const isBradycardia = selectedSoldier.vitals.heartRate < 50;
  const isHyperthermia = selectedSoldier.vitals.temperature > 38.5;
  const isHypoxia = selectedSoldier.vitals.oxygenSaturation < 92;
  const isHighStress = selectedSoldier.vitals.stressLevel === 'CRÍTICO' || selectedSoldier.vitals.stressLevel === 'ELEVADO';

  const hasAnyAnomaly = isTachycardia || isBradycardia || isHyperthermia || isHypoxia || selectedSoldier.vitals.fallDetected;

  return (
    <div className="space-y-4">
      
      {/* SubTab Navigation: Telemetry vs Fatigue Prediction */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-lg">
        <div className="flex items-center gap-2">
          <button
            id="btn-subtab-telemetry"
            onClick={() => setSubTab('telemetry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono-military tracking-wider transition-all ${
              subTab === 'telemetry' 
                ? 'bg-emerald-600 text-slate-950 shadow-md shadow-emerald-950/50' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Telemetría en Tiempo Real</span>
          </button>
          
          <button
            id="btn-subtab-trend"
            onClick={() => setSubTab('trend')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold font-mono-military tracking-wider transition-all cursor-pointer ${
              subTab === 'trend'
                ? 'bg-sky-600 text-slate-950 shadow-md shadow-sky-950/50'
                : 'text-sky-400 hover:bg-sky-950/40 border border-sky-500/30'
            }`}
          >
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Tendencia Biométrica (12h)</span>
          </button>

          <button
            id="btn-subtab-fatigue"
            onClick={() => setSubTab('fatigue')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold font-mono-military tracking-wider transition-all cursor-pointer ${
              subTab === 'fatigue' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/50' 
                : 'text-amber-400 hover:bg-amber-950/40 border border-amber-500/30'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Predicción de Fatiga (2h)</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400 hidden md:block">
          Telemetría Médica Militar E2EE
        </div>
      </div>

      {subTab === 'fatigue' ? (
        <FatiguePredictionPanel
          soldiers={soldiers}
          selectedSoldierId={selectedSoldierId}
          onSelectSoldier={onSelectSoldier}
          onTriggerVitalsSpike={onTriggerVitalsSpike}
        />
      ) : subTab === 'trend' ? (
        <BiometricTrendChart
          soldier={selectedSoldier}
          timeframeHours={12}
        />
      ) : (
        <>
          {/* Top Banner: Soldier Selector & Status */}
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-mono-military text-slate-200 font-bold">OPERADOR ACTIVO:</label>
          <select
            id="telemetry-soldier-select"
            value={selectedSoldier.id}
            onChange={(e) => onSelectSoldier(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-emerald-400 font-bold font-mono-military focus:outline-none focus:border-emerald-500 shadow-inner"
          >
            {soldiers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.callsign} - {s.name} ({s.vitals.heartRate} BPM | {s.vitals.oxygenSaturation}%)
              </option>
            ))}
          </select>

          <button
            onClick={() => tacticalAudio.playHeartPulse(selectedSoldier.vitals.heartRate)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 text-xs font-mono-military font-bold shadow transition-colors"
            title="Escuchar Tono de Frecuencia Cardíaca"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Tono Pulso</span>
          </button>
        </div>

        {/* Anomaly Badge */}
        <div>
          {hasAnyAnomaly ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/90 border border-red-500 text-red-200 text-xs font-mono-military font-bold animate-pulse shadow-lg">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>¡ANOMALÍA BIOMÉDICA DETECTADA!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-mono-military font-bold shadow">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>PARÁMETROS VITALES ESTABLES</span>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Tactical Timeline Playback Controls */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <h3 className="font-tactical text-sm font-bold text-slate-100 uppercase tracking-wider">
                LÍNEA DE TIEMPO DE REPRODUCCIÓN TÁCTICA
              </h3>
              <p className="text-[11px] text-slate-400">
                Reproducir coordenadas históricas y telemetría de {selectedSoldier.callsign} a lo largo del tiempo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {playbackIndex !== null ? (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono-military font-bold animate-pulse">
                <span>REPRODUCCIÓN ACTIVA</span>
                <span>PUNTO {playbackIndex + 1}/{routeHistory.length}</span>
              </span>
            ) : (
              <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono-military">
                🔵 TRANSMISIÓN EN TIEMPO REAL (VIVO)
              </span>
            )}

            {playbackIndex !== null && (
              <button
                onClick={() => {
                  setIsPlaying(false);
                  onPlaybackIndexChange?.(null);
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono-military border border-slate-700 transition-colors flex items-center gap-1"
                title="Volver a transmisión en tiempo real"
              >
                <RotateCcw className="w-3 h-3 text-emerald-400" />
                <span>Salir</span>
              </button>
            )}
          </div>
        </div>

        {routeHistory.length === 0 ? (
          <p className="text-xs font-mono-military text-slate-400 py-2 italic text-center">
            No hay puntos de trayectoria disponibles para reproducir en este operador aún. Espere la captura de telemetría.
          </p>
        ) : (
          <div className="space-y-3.5">
            {/* Playback Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {/* Skip to start */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    onPlaybackIndexChange?.(0);
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Ir al inicio"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                {/* Back one step */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    const prev = playbackIndex === null ? routeHistory.length - 1 : playbackIndex - 1;
                    onPlaybackIndexChange?.(Math.max(0, prev));
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Punto anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Play / Pause */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2 rounded-lg transition-all ${
                    isPlaying 
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-md shadow-amber-950' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
                  }`}
                  title={isPlaying ? 'Pausar reproducción' : 'Iniciar reproducción automática'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                {/* Forward one step */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    const curr = playbackIndex === null ? -1 : playbackIndex;
                    if (curr + 1 < routeHistory.length) {
                      onPlaybackIndexChange?.(curr + 1);
                    } else {
                      onPlaybackIndexChange?.(null); // Return to live
                    }
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Siguiente punto"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Skip to end */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    onPlaybackIndexChange?.(routeHistory.length - 1);
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Ir al final"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Speed multiplier */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono-military">
                <span className="text-slate-500 px-1.5 text-[10px]">VELOCIDAD:</span>
                {[1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaySpeed(speed)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      playSpeed === speed ? 'bg-slate-850 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-250'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Slider bar */}
            <div className="space-y-1.5">
              <input
                id="playback-range-slider"
                type="range"
                min="0"
                max={routeHistory.length - 1}
                value={playbackIndex !== null ? playbackIndex : routeHistory.length - 1}
                onChange={(e) => {
                  setIsPlaying(false);
                  onPlaybackIndexChange?.(parseInt(e.target.value, 10));
                }}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-slate-800"
              />

              <div className="flex justify-between text-[10px] font-mono-military text-slate-500">
                <span>PUNTO INICIAL ({routeHistory[0]?.timestamp || ''})</span>
                {playbackIndex !== null && (
                  <span className="text-amber-400 font-bold tracking-wider animate-pulse">
                    VISTA DE DATOS HISTÓRICOS: {routeHistory[playbackIndex]?.timestamp}
                  </span>
                )}
                <span>PUNTO FINAL ({routeHistory[routeHistory.length - 1]?.timestamp || ''})</span>
              </div>
            </div>

            {/* Micro details cards for the playback point */}
            {playbackIndex !== null && routeHistory[playbackIndex] && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs font-mono-military">
                <div className="p-1.5">
                  <span className="text-slate-500 block text-[9px] uppercase">Registro Horario:</span>
                  <span className="text-slate-200 font-bold text-sm">{routeHistory[playbackIndex].timestamp}</span>
                </div>
                <div className="p-1.5 border-l border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase">Posición GPS:</span>
                  <span className="text-cyan-400 font-bold text-xs">
                    {routeHistory[playbackIndex].lat.toFixed(5)}, {routeHistory[playbackIndex].lng.toFixed(5)}
                  </span>
                </div>
                <div className="p-1.5 border-l border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase">Frecuencia Registrada:</span>
                  <span className="text-rose-400 font-bold text-sm flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-rose-500/20 text-rose-500 animate-pulse" />
                    {routeHistory[playbackIndex].hr} BPM
                  </span>
                </div>
                <div className="p-1.5 border-l border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase">SpO2 Registrado:</span>
                  <span className="text-cyan-300 font-bold text-sm">{routeHistory[playbackIndex].spo2}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Biometric Metric Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Heart Rate (BPM) */}
        <div className={`p-4 rounded-xl border transition-all ${
          isTachycardia
            ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/50'
            : isBradycardia
            ? 'bg-amber-950/40 border-amber-500/80'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Heart className={`w-5 h-5 ${isTachycardia ? 'animate-bounce text-red-400' : ''}`} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-mono-military">FRECUENCIA CARDÍACA</p>
                <p className="text-[10px] text-slate-500">Rango Seguro: 60 - 100 BPM</p>
              </div>
            </div>
            {isTachycardia && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white font-mono-military">TAQUICARDIA</span>}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold font-mono-military ${
              isTachycardia ? 'text-red-400' : 'text-slate-100'
            }`}>
              {selectedSoldier.vitals.heartRate}
            </span>
            <span className="text-sm font-mono-military text-slate-400">BPM</span>
          </div>

          {/* Dynamic ECG Waveform graphic */}
          <div className="h-9 w-full bg-slate-950 rounded-lg p-1 border border-slate-800 flex items-center overflow-hidden relative">
            <svg className="w-full h-full text-rose-500" viewBox="0 0 200 30" preserveAspectRatio="none">
              <path
                d="M 0,15 L 30,15 L 40,5 L 50,25 L 60,10 L 70,18 L 80,15 L 120,15 L 130,5 L 140,25 L 150,10 L 160,18 L 170,15 L 200,15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={isTachycardia ? 'animate-pulse text-red-500' : 'text-emerald-400'}
              />
            </svg>
          </div>

          <button
            onClick={() => onTriggerVitalsSpike(selectedSoldier.id, 'bpm')}
            className="mt-2.5 w-full py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-mono-military transition-colors"
          >
            Simular Pico Cardíaco (155 BPM)
          </button>
        </div>

        {/* Body Temperature (°C) */}
        <div className={`p-4 rounded-xl border transition-all ${
          isHyperthermia
            ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-mono-military">TEMPERATURA CORPORAL</p>
                <p className="text-[10px] text-slate-500">Rango Normal: 36.2 - 37.5°C</p>
              </div>
            </div>
            {isHyperthermia && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white font-mono-military">HIPERTERMIA</span>}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold font-mono-military ${
              isHyperthermia ? 'text-amber-400' : 'text-slate-100'
            }`}>
              {selectedSoldier.vitals.temperature}
            </span>
            <span className="text-sm font-mono-military text-slate-400">°C</span>
          </div>

          {/* Temperature progress gauge */}
          <div className="space-y-1">
            <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isHyperthermia ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, (selectedSoldier.vitals.temperature - 35) * 20))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono-military text-slate-500">
              <span>35°C (Hipotermia)</span>
              <span>39°C+ (Crítico)</span>
            </div>
          </div>

          <button
            onClick={() => onTriggerVitalsSpike(selectedSoldier.id, 'temp')}
            className="mt-2.5 w-full py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-mono-military transition-colors"
          >
            Simular Golpe de Calor (39.1°C)
          </button>
        </div>

        {/* Blood Oxygen Saturation (SpO2 %) */}
        <div className={`p-4 rounded-xl border transition-all ${
          isHypoxia
            ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-mono-military">SATURACIÓN SpO2</p>
                <p className="text-[10px] text-slate-500">Óptimo: 95% - 100%</p>
              </div>
            </div>
            {isHypoxia && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white font-mono-military animate-pulse">HIPOXIA</span>}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold font-mono-military ${
              isHypoxia ? 'text-red-400' : 'text-slate-100'
            }`}>
              {selectedSoldier.vitals.oxygenSaturation}
            </span>
            <span className="text-sm font-mono-military text-slate-400">%</span>
          </div>

          {/* SpO2 progress gauge */}
          <div className="space-y-1">
            <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isHypoxia ? 'bg-red-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${selectedSoldier.vitals.oxygenSaturation}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono-military text-slate-500">
              <span>85% (Emergencia)</span>
              <span>100% (Normal)</span>
            </div>
          </div>

          <button
            onClick={() => onTriggerVitalsSpike(selectedSoldier.id, 'spo2')}
            className="mt-2.5 w-full py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-mono-military transition-colors"
          >
            Simular Caída SpO2 (87%)
          </button>
        </div>

        {/* Inertial Sensor / Fall / Impact G-Force */}
        <div className={`p-4 rounded-xl border transition-all ${
          selectedSoldier.vitals.fallDetected
            ? 'bg-red-950/60 border-red-500 shadow-xl shadow-red-950/60'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-mono-military">SENSOR DE IMPACTO / CAÍDA</p>
                <p className="text-[10px] text-slate-500">Acelerómetro Inercial 9-DOF</p>
              </div>
            </div>
            {selectedSoldier.vitals.fallDetected && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white font-mono-military animate-pulse">
                HOMBRE CAÍDO
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold font-mono-military text-slate-100">
              {selectedSoldier.vitals.impactGForce}
            </span>
            <span className="text-sm font-mono-military text-slate-400">G-Force</span>
          </div>

          <div className="bg-slate-950 p-2 rounded text-[11px] font-mono-military text-slate-300 space-y-0.5 border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Estado Inercial:</span>
              <span className={selectedSoldier.vitals.fallDetected ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                {selectedSoldier.vitals.fallDetected ? 'ALERTA DE IMPACTO' : 'MOVIMIENTO ACTIVO'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pasos Patrulla:</span>
              <span>{selectedSoldier.vitals.steps.toLocaleString()} pasos</span>
            </div>
          </div>

          <button
            onClick={() => onTriggerVitalsSpike(selectedSoldier.id, 'fall')}
            className="mt-2.5 w-full py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 text-[11px] font-mono-military transition-colors"
          >
            Simular Detección de Caída (3.8G)
          </button>
        </div>

      </div>

      {/* Geofencing Status & Boundary Control Card */}
      <div className={`p-4 rounded-xl border transition-all ${
        selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS'
          ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/50' 
          : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${
              selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS'
                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <ShieldAlert className={`w-5 h-5 ${selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS' ? 'animate-bounce text-red-400' : 'text-emerald-400'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-mono-military">ESTADO DE PERÍMETRO TÁCTICO (GEOFENCING)</p>
              <p className="text-[10px] text-slate-500">Monitoreo automático de salida de perimetrales definidos para la Base de Coveñas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-left">
              <span className="text-[10px] block text-slate-500 font-mono-military">ZONA ACTUAL:</span>
              <span className={`text-xs font-mono-military font-bold px-2 py-1 rounded ${
                selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS'
                  ? '🔴 FUERA DE LÍMITES'
                  : `🟢 DENTRO: ${INITIAL_ZONES.find((z) => z.id === selectedSoldier.currentZoneId)?.name || 'HQ base'}`}
              </span>
            </div>
            
            <button
              onClick={() => onTriggerVitalsSpike(selectedSoldier.id, 'geofence')}
              disabled={selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS'}
              className={`px-3 py-1.5 rounded text-xs font-mono-military transition-all ${
                selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS'
                  ? 'bg-red-950/40 border border-red-800/20 text-red-400/50 cursor-not-allowed'
                  : 'bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 hover:shadow-lg'
              }`}
            >
              {selectedSoldier.currentZoneId === 'OUT_OF_BOUNDS' ? 'Unidad Fuera de Límites' : 'Simular Salida de Base (Test)'}
            </button>
          </div>
        </div>
      </div>

      {/* Historical Telemetry Recharts Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-tactical text-base font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>HISTORIAL DE TELEMETRÍA BIOMÉTRICA EN TIEMPO REAL</span>
            </h3>
            <p className="text-xs text-slate-400">
              Evolución cronológica de signos vitales transmitidos por enlace satelital E2EE
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono-military">
            <button
              onClick={() => setActiveMetricTab('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeMetricTab === 'all' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Multicanal
            </button>
            <button
              onClick={() => setActiveMetricTab('hr')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeMetricTab === 'hr' ? 'bg-slate-800 text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Frecuencia (BPM)
            </button>
            <button
              onClick={() => setActiveMetricTab('temp')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeMetricTab === 'temp' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Temperatura (°C)
            </button>
            <button
              onClick={() => setActiveMetricTab('spo2')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeMetricTab === 'spo2' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Oximetría (%)
            </button>
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                }}
              />
              {(activeMetricTab === 'all' || activeMetricTab === 'hr') && (
                <Area
                  type="monotone"
                  dataKey="heartRate"
                  name="Frecuencia Cardíaca (BPM)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#hrGrad)"
                />
              )}
              {(activeMetricTab === 'all' || activeMetricTab === 'temp') && (
                <Line
                  type="monotone"
                  dataKey="temp"
                  name="Temperatura (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              )}
              {(activeMetricTab === 'all' || activeMetricTab === 'spo2') && (
                <Area
                  type="monotone"
                  dataKey="spo2"
                  name="Oximetría SpO2 (%)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#spo2Grad)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Wearable Device Hardware Diagnostics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Device Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>DIAGNÓSTICO DEL DISPOSITIVO VESTIBLE</span>
          </h3>

          <div className="space-y-2.5 text-xs font-mono-military text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Modelo Hardware:</span>
              <span className="text-slate-100 font-bold">{selectedSoldier.device.model}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Versión Firmware:</span>
              <span className="text-cyan-400">{selectedSoldier.device.firmwareVersion}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Tipo de Enlace:</span>
              <span className="text-emerald-400 font-bold">{selectedSoldier.device.connectionType}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Intensidad Señal (RSSI):</span>
              <span className="text-slate-100">{selectedSoldier.device.signalStrength} dBm (Excelente)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Batería Restante:</span>
              <span className={`font-bold ${selectedSoldier.device.batteryLevel < 30 ? 'text-red-400' : 'text-emerald-400'}`}>
                {selectedSoldier.device.batteryLevel}% (~18 horas estimadas)
              </span>
            </div>
          </div>
        </div>

        {/* Security & Cryptography Protocol */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>SEGURIDAD & ENCRIPTACIÓN E2EE MILITAR</span>
          </h3>

          <div className="space-y-2.5 text-xs font-mono-military text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Algoritmo Criptográfico:</span>
              <span className="text-emerald-400 font-bold">{selectedSoldier.device.encryptionStatus}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Huella Clave Pública:</span>
              <span className="text-cyan-300">{selectedSoldier.device.encryptionKeyHash}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Autenticación de Trama:</span>
              <span className="text-slate-100">HMAC-SHA384 / Poly1305</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Estado de Sincronización:</span>
              <span className="text-emerald-400">{selectedSoldier.device.lastSync}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Resistencia a Interferencias:</span>
              <span className="text-slate-100">Salto de Frecuencia FHSS Activo</span>
            </div>
          </div>
        </div>

      </div>
        </>
      )}

    </div>
  );
};
