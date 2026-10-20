import React, { useState } from 'react';
import { Soldier, TacticalAlert, TacticalZone } from '../types';
import { 
  Sparkles, 
  Shield, 
  FileText, 
  RefreshCw, 
  X, 
  Copy, 
  Check, 
  AlertTriangle, 
  Activity, 
  CheckCircle2 
} from 'lucide-react';

interface AiTacticalSitrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  soldiers: Soldier[];
  alerts: TacticalAlert[];
  zones: TacticalZone[];
}

export const AiTacticalSitrepModal: React.FC<AiTacticalSitrepModalProps> = ({
  isOpen,
  onClose,
  soldiers,
  alerts,
  zones,
}) => {
  const [report, setReport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateSitrep = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-sitrep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soldiers,
          alerts,
          activeZones: zones.map((z) => ({
            code: z.code,
            name: z.name,
            riskLevel: z.riskLevel,
          })),
        }),
      });

      const data = await res.json();
      if (data.report) {
        setReport(data.report);
      } else if (data.fallbackReport) {
        setReport(data.fallbackReport);
      } else {
        setError(data.error || 'Error al conectar con el asesor de inteligencia');
      }
    } catch (e: any) {
      console.error(e);
      setError('Error de comunicación con el motor de inteligencia artificial.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-tactical text-base font-bold text-slate-100 flex items-center gap-2">
                <span>ASESOR TÁCTICO & SITREP IA (GEMINI C4I)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono-military border border-cyan-800">
                  GEMINI 3.8 FLASH
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono-military">
                Evaluación autónoma de biometría, amenazas perimetrales y prescripciones operativas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Quick Metrics Summary Bar */}
          <div className="grid grid-cols-3 gap-2 text-xs font-mono-military">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">PERSONAL MONITOREADO:</span>
              <span className="text-emerald-400 font-bold text-sm">{soldiers.length} Operadores</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">ALERTAS ACTIVAS:</span>
              <span className="text-red-400 font-bold text-sm">{alerts.filter(a => !a.resolved).length} Incidentes</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">SECTORES GEOFENCE:</span>
              <span className="text-cyan-400 font-bold text-sm">{zones.length} Zonas Base</span>
            </div>
          </div>

          {/* Action Trigger button if no report yet */}
          {!report && !isLoading && (
            <div className="p-8 text-center bg-slate-950 rounded-xl border border-dashed border-slate-800 space-y-3">
              <Sparkles className="w-10 h-10 text-cyan-400 mx-auto animate-pulse" />
              <h3 className="font-tactical text-base font-bold text-slate-200">
                Generar Informe de Situación Táctica (SITREP)
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                El motor de inteligencia artificial procesará los signos vitales, las posiciones GPS de alta precisión y las infracciones de perímetro para emitir un diagnóstico operativo de nivel militar.
              </p>
              <button
                id="btn-generate-sitrep-submit"
                onClick={generateSitrep}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold font-mono-military tracking-wider shadow-lg shadow-cyan-950 transition-all flex items-center gap-2 mx-auto active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>EJECUTAR ANÁLISIS C4I CON IA</span>
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto animate-spin" />
              <p className="text-sm font-mono-military text-slate-300 font-bold">
                PROCESANDO TELEMETRÍA TÁCTICA & DIAGNÓSTICO BIOMÉDICO...
              </p>
              <p className="text-xs text-slate-500">
                Correlacionando anomalías cardíacas, oximetría y zonas de alto riesgo con Gemini 3.8 Flash
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-500/80 rounded-xl text-red-200 text-xs font-mono-military flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Rendered SITREP Report */}
          {report && !isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono-military text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  INFORME SITREP GENERADO EXITOSAMENTE
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyReport}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono-military flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <button
                    onClick={generateSitrep}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono-military flex items-center gap-1 transition-colors"
                    title="Regenerar SITREP actualizado"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Actualizar</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-200 text-xs leading-relaxed font-mono-military whitespace-pre-wrap">
                {report}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono-military transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  );
};
