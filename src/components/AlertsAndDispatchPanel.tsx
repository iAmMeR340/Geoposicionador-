import React, { useState } from 'react';
import { TacticalAlert, Soldier } from '../types';
import { 
  Bell, 
  AlertTriangle, 
  AlertOctagon, 
  ShieldAlert, 
  CheckCircle2, 
  Crosshair, 
  Radio, 
  Send, 
  Flame, 
  Heart, 
  Thermometer, 
  Wind,
  Share2,
  Trash2,
  Check
} from 'lucide-react';
import { tacticalAudio } from '../utils/audioAlerts';

interface AlertsAndDispatchPanelProps {
  alerts: TacticalAlert[];
  soldiers: Soldier[];
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onDispatchQRF: (alert: TacticalAlert) => void;
  onDispatchMedevac: (alert: TacticalAlert) => void;
  onSelectSoldier: (soldierId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const AlertsAndDispatchPanel: React.FC<AlertsAndDispatchPanelProps> = ({
  alerts,
  soldiers,
  onAcknowledgeAlert,
  onResolveAlert,
  onDispatchQRF,
  onDispatchMedevac,
  onSelectSoldier,
  onClose,
  isModal = false,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('TODAS');

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'TODAS') return true;
    return a.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'EMERGENCY':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-military bg-red-600 text-white animate-pulse">
            EMERGENCIA FLASH
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-military bg-red-950 text-red-300 border border-red-600">
            CRÍTICO
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-military bg-amber-950 text-amber-300 border border-amber-600">
            ADVERTENCIA
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-military bg-blue-950 text-blue-300 border border-blue-600">
            INFORMATIVO
          </span>
        );
    }
  };

  return (
    <div className={isModal ? "flex flex-col h-full bg-transparent border-0 p-0 shadow-none" : "bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col h-full"}>
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="font-tactical text-base font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>CENTRO DE ALERTAS TEMPRANAS & DESPACHO C4I</span>
            <span className="text-xs px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-mono-military">
              {alerts.filter((a) => !a.resolved).length} ACTIVAS
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Recepción de notificaciones push de impacto, geocercas y umbrales biométricos
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono-military">
            {['TODAS', 'EMERGENCY', 'CRITICAL', 'WARNING'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterSeverity === sev
                    ? 'bg-slate-800 text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev === 'EMERGENCY' ? 'Emergencias' : sev === 'CRITICAL' ? 'Críticas' : sev === 'WARNING' ? 'Advertencias' : 'Todas'}
              </button>
            ))}
          </div>

          {/* Close action directly inside header */}
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono-military transition-colors"
            >
              CERRAR
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono-military">
            No hay alertas registradas en esta categoría. Todos los sectores se reportan seguros.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isResolved = alert.resolved;
            const isEmergency = alert.severity === 'EMERGENCY' || alert.severity === 'CRITICAL';

            return (
              <div
                key={alert.id}
                id={`alert-item-${alert.id}`}
                className={`p-4 rounded-xl border transition-all ${
                  isResolved
                    ? 'bg-slate-950/40 border-slate-800 opacity-60'
                    : isEmergency
                    ? 'bg-red-950/30 border-red-500/70 shadow-lg shadow-red-950/40'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(alert.severity)}
                    <span className="font-tactical font-bold text-sm text-slate-100">
                      {alert.title}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono-military text-slate-400 flex items-center gap-1">
                    <span>{alert.timestamp}</span>
                    {alert.acknowledged && !isResolved && (
                      <span className="text-cyan-400 font-semibold">(Reconocida)</span>
                    )}
                    {isResolved && <span className="text-emerald-400 font-semibold">(Resuelta)</span>}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  {alert.description}
                </p>

                {/* Vitals Snapshot if attached */}
                {alert.vitalsSnapshot && (
                  <div className="flex items-center gap-4 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 mb-3 text-xs font-mono-military">
                    <span className="text-slate-400">Snapshot Biométrico:</span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <Heart className="w-3 h-3" /> {alert.vitalsSnapshot.heartRate} BPM
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Thermometer className="w-3 h-3" /> {alert.vitalsSnapshot.temperature}°C
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Wind className="w-3 h-3" /> {alert.vitalsSnapshot.oxygenSaturation}% SpO2
                    </span>
                  </div>
                )}

                {/* Associated Operator & Dispatch Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectSoldier(alert.soldierId)}
                      className="text-xs font-mono-military text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>{alert.soldierCallsign}</span>
                    </button>
                    <span className="text-[10px] text-slate-400">({alert.soldierName})</span>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!isResolved && (
                      <>
                        <button
                          id={`btn-dispatch-medevac-${alert.id}`}
                          onClick={() => onDispatchMedevac(alert)}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono-military font-bold shadow transition-colors flex items-center gap-1"
                        >
                          <span>Despachar MEDEVAC</span>
                        </button>

                        <button
                          id={`btn-dispatch-qrf-${alert.id}`}
                          onClick={() => onDispatchQRF(alert)}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-mono-military font-bold shadow transition-colors flex items-center gap-1"
                        >
                          <span>Despachar QRF</span>
                        </button>

                        {!alert.acknowledged && (
                          <button
                            id={`btn-ack-${alert.id}`}
                            onClick={() => onAcknowledgeAlert(alert.id)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono-military transition-colors"
                          >
                            Reconocer
                          </button>
                        )}

                        <button
                          id={`btn-resolve-${alert.id}`}
                          onClick={() => onResolveAlert(alert.id)}
                          className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 text-xs font-mono-military transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Marcar Resuelto</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
