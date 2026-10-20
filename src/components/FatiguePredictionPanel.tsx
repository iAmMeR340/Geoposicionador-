import React, { useState, useMemo } from 'react';
import { Soldier } from '../types';
import { 
  analyzeSoldierFatigue, 
  FatiguePredictionAnalysis 
} from '../utils/fatiguePredictor';
import { 
  Activity, 
  Heart, 
  Wind, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  RotateCcw, 
  Zap, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Radio, 
  UserCheck, 
  Flame, 
  SlidersHorizontal,
  Info,
  ShieldCheck,
  Award
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
  ReferenceDot 
} from 'recharts';
import { tacticalAudio } from '../utils/audioAlerts';

interface FatiguePredictionPanelProps {
  soldiers: Soldier[];
  selectedSoldierId: string | null;
  onSelectSoldier: (id: string) => void;
  onTriggerVitalsSpike?: (soldierId: string, metric: 'bpm' | 'temp' | 'spo2' | 'fall' | 'geofence') => void;
}

export const FatiguePredictionPanel: React.FC<FatiguePredictionPanelProps> = ({
  soldiers,
  selectedSoldierId,
  onSelectSoldier,
  onTriggerVitalsSpike,
}) => {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(selectedSoldierId || soldiers[0]?.id || '');
  const [timeframeMinutes, setTimeframeMinutes] = useState<60 | 120>(120);
  const [simulationActive, setSimulationActive] = useState<boolean>(false);

  // Compute fatigue regression analysis for ALL active soldiers
  const analyses: FatiguePredictionAnalysis[] = useMemo(() => {
    return soldiers.map(s => analyzeSoldierFatigue(s));
  }, [soldiers]);

  // Selected soldier analysis
  const currentAnalysis = useMemo(() => {
    return analyses.find(a => a.soldierId === selectedAnalysisId) || analyses[0];
  }, [analyses, selectedAnalysisId]);

  const currentSoldier = useMemo(() => {
    return soldiers.find(s => s.id === currentAnalysis?.soldierId) || soldiers[0];
  }, [soldiers, currentAnalysis]);

  // Count critical collapse risks
  const criticalCollapseCount = analyses.filter(a => a.riskLevel === 'COLAPSO_INMINENTE').length;
  const highRiskCount = analyses.filter(a => a.riskLevel === 'ALTO').length;

  // Generate historical + linear regression projected chart data
  const chartData = useMemo(() => {
    if (!currentSoldier) return [];

    const history = currentSoldier.routeHistory || [];
    const totalPoints = history.length || 1;
    const timeStepMinutes = Math.max(1, timeframeMinutes / Math.max(1, totalPoints - 1));

    const data: any[] = [];

    // 1. Historical 2-hour points
    history.forEach((pt, idx) => {
      const minute = Math.round(idx * timeStepMinutes);
      const hr = pt.hr || currentSoldier.vitals.heartRate;
      const spo2 = pt.spo2 || currentSoldier.vitals.oxygenSaturation;

      // Linear regression fit line values
      const hrFit = currentAnalysis.hrRegression.slope * minute + currentAnalysis.hrRegression.intercept;
      const spo2Fit = currentAnalysis.spo2Regression.slope * minute + currentAnalysis.spo2Regression.intercept;

      data.push({
        minute: `- ${timeframeMinutes - minute}m`,
        rawMinute: minute,
        isProjection: false,
        heartRate: hr,
        spo2: spo2,
        hrFit: Number(hrFit.toFixed(1)),
        spo2Fit: Number(spo2Fit.toFixed(1)),
        projectedHR: null,
        projectedSpO2: null,
      });
    });

    // 2. Future 60-minute Projection Points (Linear Regression Extrapolation)
    const lastMinute = timeframeMinutes;
    const futureSteps = [15, 30, 45, 60];

    futureSteps.forEach((futureMins) => {
      const projMin = lastMinute + futureMins;
      const projHR = currentAnalysis.hrRegression.slope * projMin + currentAnalysis.hrRegression.intercept;
      const projSpO2 = currentAnalysis.spo2Regression.slope * projMin + currentAnalysis.spo2Regression.intercept;

      data.push({
        minute: `+${futureMins}m (Futuro)`,
        rawMinute: projMin,
        isProjection: true,
        heartRate: null,
        spo2: null,
        hrFit: null,
        spo2Fit: null,
        projectedHR: Math.min(200, Math.max(40, Number(projHR.toFixed(1)))),
        projectedSpO2: Math.min(100, Math.max(70, Number(projSpO2.toFixed(1)))),
      });
    });

    return data;
  }, [currentSoldier, currentAnalysis, timeframeMinutes]);

  const handleSelectSoldier = (id: string) => {
    setSelectedAnalysisId(id);
    onSelectSoldier(id);
  };

  const handleTriggerSimulatedSpike = () => {
    if (onTriggerVitalsSpike && currentSoldier) {
      tacticalAudio.playEmergencySiren();
      onTriggerVitalsSpike(currentSoldier.id, 'bpm');
      setSimulationActive(true);
      setTimeout(() => setSimulationActive(false), 5000);
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 text-slate-100">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/50 shadow-lg shadow-amber-950/50">
              <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-tactical font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                Predicción Táctica de Fatiga & Colapso Inminente
                <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full">
                  REGRESIÓN LINEAL (2 HORAS)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Modelado matemático continuo (y = mx + b) de derivación cardíaca (BPM) y desaturación (SpO2) a +15m, +30m y +60m.
              </p>
            </div>
          </div>
        </div>

        {/* Global Alert Status Badges */}
        <div className="flex items-center gap-3">
          {criticalCollapseCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/90 border border-red-500/80 rounded-xl text-red-300 text-xs font-bold shadow-lg animate-pulse">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{criticalCollapseCount} COLAPSO(S) EN &lt; 20 MIN</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SIN RIESGO DE COLAPSO INMEDIATO</span>
            </div>
          )}

          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setTimeframeMinutes(60)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                timeframeMinutes === 60 ? 'bg-amber-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Hora
            </button>
            <button
              onClick={() => setTimeframeMinutes(120)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                timeframeMinutes === 120 ? 'bg-amber-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2 Horas
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Personal Evaluado</span>
            <span className="text-xl font-bold font-mono text-slate-100">{soldiers.length} Operadores</span>
          </div>
          <UserCheck className="w-6 h-6 text-emerald-400 opacity-80" />
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Riesgo Alto / Crítico</span>
            <span className="text-xl font-bold font-mono text-amber-400">{criticalCollapseCount + highRiskCount} Unidades</span>
          </div>
          <AlertTriangle className="w-6 h-6 text-amber-400 opacity-80" />
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Deriva Cardíaca Promedio</span>
            <span className="text-xl font-bold font-mono text-sky-400">
              +{(analyses.reduce((acc, a) => acc + Math.max(0, a.hrRegression.slope), 0) / analyses.length).toFixed(2)} <span className="text-xs">BPM/min</span>
            </span>
          </div>
          <TrendingUp className="w-6 h-6 text-sky-400 opacity-80" />
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Confianza Algoritmo (R²)</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {Math.round((analyses.reduce((acc, a) => acc + a.hrRegression.r2, 0) / analyses.length) * 100)}%
            </span>
          </div>
          <Award className="w-6 h-6 text-emerald-400 opacity-80" />
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: OPERATOR SELECTION & FATIGUE RANKING ROSTER (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              Ranking de Fatiga & Tendencia (2 Horas)
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Selecciona un operador</span>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {analyses.map((analysis) => {
              const isSelected = analysis.soldierId === selectedAnalysisId;
              const isCritical = analysis.riskLevel === 'COLAPSO_INMINENTE';
              const isHigh = analysis.riskLevel === 'ALTO';

              return (
                <div
                  key={analysis.soldierId}
                  onClick={() => handleSelectSoldier(analysis.soldierId)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-500 shadow-lg shadow-amber-950/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${
                        isCritical ? 'bg-red-500 animate-ping' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <div>
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          {analysis.rank} {analysis.soldierName}
                          <span className="font-mono text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/60">
                            {analysis.soldierCallsign}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                          {analysis.squad}
                        </span>
                      </div>
                    </div>

                    {/* Risk Badge */}
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                        isCritical 
                          ? 'bg-red-950 text-red-300 border-red-800 animate-pulse'
                          : isHigh 
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {analysis.riskLevel.replace('_', ' ')}
                      </span>
                      {analysis.timeToCollapseMinutes !== null && (
                        <span className="text-[10px] font-mono text-amber-400 block mt-1">
                          Colapso: ~{analysis.timeToCollapseMinutes} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Biometric Slopes & Current Vitals */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Frec. Cardíaca</span>
                      <span className={`font-bold flex items-center gap-1 ${
                        analysis.currentHR > 140 ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        <Heart className="w-3 h-3 text-rose-400 inline" />
                        {analysis.currentHR} BPM
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Deriva (Pendiente ΔHR)</span>
                      <span className={`font-bold flex items-center gap-0.5 ${
                        analysis.hrRegression.slope > 0.3 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {analysis.hrRegression.slope >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {analysis.hrRegression.slope > 0 ? `+${analysis.hrRegression.slope.toFixed(2)}` : analysis.hrRegression.slope.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Ajuste (R²)</span>
                      <span className="text-sky-400 font-bold">
                        {Math.round(analysis.hrRegression.r2 * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: REGRESSION GRAPH & COMMAND ACTION CARD (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* REGRESSION LINE CHART */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Curva de Regresión Lineal & Proyección Futura (+60m): {currentAnalysis?.soldierCallsign}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Límite de Agotamiento Cardíaco: 165 BPM
              </span>
            </div>

            {/* Recharts Chart Area */}
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="minute" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                  />
                  <YAxis 
                    yAxisId="left" 
                    domain={[40, 180]} 
                    stroke="#f43f5e" 
                    fontSize={10} 
                    unit=" BPM" 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    domain={[85, 100]} 
                    stroke="#38bdf8" 
                    fontSize={10} 
                    unit="%" 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} 
                  />

                  {/* Critical Threshold Lines */}
                  <ReferenceLine yAxisId="left" y={165} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Límite Colapso 165 BPM', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                  <ReferenceLine yAxisId="right" y={90} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Límite Hipoxia 90%', fill: '#3b82f6', fontSize: 10, position: 'bottom' }} />

                  {/* Historical Measured Heart Rate (Solid Pink) */}
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="heartRate" 
                    name="FC Medida (BPM)" 
                    stroke="#f43f5e" 
                    strokeWidth={2.5} 
                    dot={{ r: 2 }} 
                  />

                  {/* Regression Linear Fit Line (Orange) */}
                  <Line 
                    yAxisId="left" 
                    type="linear" 
                    dataKey="hrFit" 
                    name="Ajuste Regresión (2h)" 
                    stroke="#f59e0b" 
                    strokeWidth={1.5} 
                    strokeDasharray="2 2" 
                    dot={false} 
                  />

                  {/* Projected Future Heart Rate (Dotted Red) */}
                  <Line 
                    yAxisId="left" 
                    type="linear" 
                    dataKey="projectedHR" 
                    name="Proyección Futura (BPM)" 
                    stroke="#ef4444" 
                    strokeWidth={2.5} 
                    strokeDasharray="5 5" 
                    dot={{ r: 4, fill: '#ef4444' }} 
                  />

                  {/* Historical SpO2 (Solid Blue) */}
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="spo2" 
                    name="SpO2 Medido (%)" 
                    stroke="#38bdf8" 
                    strokeWidth={2} 
                    dot={false} 
                  />

                  {/* Projected Future SpO2 (Dotted Light Blue) */}
                  <Line 
                    yAxisId="right" 
                    type="linear" 
                    dataKey="projectedSpO2" 
                    name="Proyección SpO2 (%)" 
                    stroke="#0284c7" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    dot={{ r: 3 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Regression Metrics Analysis Footer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Proyección +15m</span>
                <span className="text-amber-400 font-bold">{currentAnalysis?.hrRegression.projectedValue15m} BPM</span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Proyección +30m</span>
                <span className="text-orange-400 font-bold">{currentAnalysis?.hrRegression.projectedValue30m} BPM</span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Proyección +60m</span>
                <span className="text-red-400 font-bold">{currentAnalysis?.hrRegression.projectedValue60m} BPM</span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Tiempo p/ Colapso</span>
                <span className="text-rose-400 font-bold">
                  {currentAnalysis?.timeToCollapseMinutes !== null ? `~${currentAnalysis?.timeToCollapseMinutes} min` : 'Estable'}
                </span>
              </div>
            </div>
          </div>

          {/* COMMAND ACTION CARD & PROTOCOL MITIGATION */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Protocolo Táctico de Mitigación & Órdenes de Mando
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                E2EE ENLACE ACTIVO
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              {currentAnalysis?.recommendation}
            </p>

            {/* Protocol checklist */}
            <div className="space-y-1.5 pt-1">
              {currentAnalysis?.mitigationProtocol.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-850">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {/* Interactive Simulation Trigger for Testing */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleTriggerSimulatedSpike}
                className={`px-3 py-2 rounded-lg text-xs font-bold font-mono tracking-wider transition-transform active:scale-95 flex items-center gap-1.5 ${
                  simulationActive 
                    ? 'bg-red-600 text-white animate-bounce' 
                    : 'bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 shadow-md'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Simular Aceleración / Deriva Táctica (BPM)</span>
              </button>

              <span className="text-[10px] text-slate-500 font-mono">
                Regresión lineal continua reevaluada cada 5 segundos.
              </span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
