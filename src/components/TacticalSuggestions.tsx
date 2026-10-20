import React from 'react';
import { Soldier, TacticalZone, TacticalAlert } from '../types';
import { Lightbulb, ArrowRight, ShieldAlert, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface TacticalSuggestionsProps {
  soldiers: Soldier[];
  zones: TacticalZone[];
  alerts: TacticalAlert[];
  onSelectSoldier: (id: string) => void;
}

interface Suggestion {
  id: string;
  type: 'REDISTRIBUTE' | 'BUDDY_SYSTEM' | 'REST' | 'BALANCED';
  priority: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  actionableText?: string;
  sourceSoldierId?: string;
  targetZoneId?: string;
}

export const TacticalSuggestions: React.FC<TacticalSuggestionsProps> = ({
  soldiers,
  zones,
  alerts,
  onSelectSoldier,
}) => {
  // Execute rule-based decision model
  const getSuggestions = (): Suggestion[] => {
    const activeAlerts = alerts.filter(a => !a.resolved);
    const suggestions: Suggestion[] = [];

    // 1. Calculate staff density per zone
    const zoneStaff: Record<string, Soldier[]> = {};
    zones.forEach(z => {
      zoneStaff[z.id] = [];
    });
    // Group soldiers by zone
    soldiers.forEach(s => {
      if (s.currentZoneId && s.currentZoneId !== 'OUT_OF_BOUNDS') {
        if (!zoneStaff[s.currentZoneId]) {
          zoneStaff[s.currentZoneId] = [];
        }
        zoneStaff[s.currentZoneId].push(s);
      }
    });

    // 2. Group active alerts by zone
    const zoneAlerts: Record<string, TacticalAlert[]> = {};
    zones.forEach(z => {
      zoneAlerts[z.id] = [];
    });
    activeAlerts.forEach(a => {
      const soldier = soldiers.find(s => s.id === a.soldierId);
      if (soldier && soldier.currentZoneId && soldier.currentZoneId !== 'OUT_OF_BOUNDS') {
        if (!zoneAlerts[soldier.currentZoneId]) {
          zoneAlerts[soldier.currentZoneId] = [];
        }
        zoneAlerts[soldier.currentZoneId].push(a);
      }
    });

    // RULE 1: Understaffed Zone under active alert threat
    // If a zone has alerts > 0 and staff <= 1, it needs immediate reinforcement
    const criticalUnderstaffedZones = Object.keys(zoneAlerts).filter(zoneId => {
      const alertCount = zoneAlerts[zoneId]?.length || 0;
      const staffCount = zoneStaff[zoneId]?.length || 0;
      return alertCount > 0 && staffCount <= 1;
    });

    // Find calm zones with surplus staff (staff >= 2 and alerts === 0)
    const calmSurplusZones = Object.keys(zoneStaff).filter(zoneId => {
      const alertCount = zoneAlerts[zoneId]?.length || 0;
      const staffCount = zoneStaff[zoneId]?.length || 0;
      return alertCount === 0 && staffCount >= 2;
    });

    if (criticalUnderstaffedZones.length > 0) {
      criticalUnderstaffedZones.forEach(understaffedId => {
        const targetZone = zones.find(z => z.id === understaffedId);
        const activeAlertCount = zoneAlerts[understaffedId].length;
        
        if (targetZone) {
          // Attempt to find a candidate from a surplus zone
          let candidate: Soldier | undefined;
          let sourceZoneName = '';

          for (const surplusId of calmSurplusZones) {
            const sourceZone = zones.find(z => z.id === surplusId);
            const staffList = zoneStaff[surplusId];
            if (sourceZone && staffList && staffList.length > 0) {
              // Pick someone who is not currently in a critical state
              candidate = staffList.find(s => s.status !== 'CRITICO' && s.status !== 'SOS_EMERGENCIA');
              if (candidate) {
                sourceZoneName = sourceZone.name;
                break;
              }
            }
          }

          if (candidate) {
            suggestions.push({
              id: `rule-redistribute-${understaffedId}`,
              type: 'REDISTRIBUTE',
              priority: 'CRITICAL',
              title: 'Redistribución Táctica de Emergencia',
              description: `El sector '${targetZone.name}' registra ${activeAlertCount} alerta(s) activa(s) con solo ${zoneStaff[understaffedId]?.length || 0} operador(es). Se recomienda transferir inmediatamente soporte de apoyo.`,
              actionableText: `Desplegar a ${candidate.callsign} de ${sourceZoneName} a ${targetZone.name}`,
              sourceSoldierId: candidate.id,
              targetZoneId: targetZone.id,
            });
          } else {
            // General reinforcement call
            suggestions.push({
              id: `rule-reinforce-${understaffedId}`,
              type: 'REDISTRIBUTE',
              priority: 'WARNING',
              title: 'Refuerzo de Sector Requerido',
              description: `El sector '${targetZone.name}' tiene alta densidad de alertas (${activeAlertCount}) y está en estado de vulnerabilidad de personal.`,
              actionableText: `Asignar operador de reserva a ${targetZone.name}`,
            });
          }
        }
      });
    }

    // RULE 2: Buddy System Violation (Single Operator in High Risk Zone)
    // If a zone is high risk or critical, and has exactly 1 operator, recommend deploying a backup buddy
    zones.forEach(z => {
      if (z.riskLevel === 'ALTO_RIESGO' || z.riskLevel === 'ZONA_CRITICA_RESTRINGIDA') {
        const staffInZone = zoneStaff[z.id] || [];
        if (staffInZone.length === 1) {
          const loneOperator = staffInZone[0];
          suggestions.push({
            id: `rule-buddy-${z.id}`,
            type: 'BUDDY_SYSTEM',
            priority: 'WARNING',
            title: 'Infracción de Binomio de Seguridad',
            description: `El operador ${loneOperator.callsign} se encuentra patrullando solo en '${z.name}', clasificada como ${z.riskLevel.replace(/_/g, ' ')}. El protocolo C4I exige cobertura dual para mitigar emboscadas o desvanecimientos.`,
            actionableText: `Asociar compañero a ${loneOperator.callsign}`,
            sourceSoldierId: loneOperator.id,
          });
        }
      }
    });

    // RULE 3: High stress or fatigue operator
    soldiers.forEach(s => {
      if (s.vitals.fatigueLevel > 75 || s.vitals.stressLevel === 'CRÍTICO' || s.vitals.stressLevel === 'ELEVADO') {
        const alertExists = activeAlerts.some(a => a.soldierId === s.id);
        if (!alertExists) { // Only suggest if not already flagged in critical alert card
          suggestions.push({
            id: `rule-rest-${s.id}`,
            type: 'REST',
            priority: 'WARNING',
            title: 'Fatiga / Estrés Crítico Detectado',
            description: `La telemetría de ${s.callsign} reporta fatiga del ${s.vitals.fatigueLevel}% y estrés ${s.vitals.stressLevel}. Se recomienda ordenar alto en la patrulla y relevo preventivo de guardia.`,
            actionableText: `Enviar orden de descanso a ${s.callsign}`,
            sourceSoldierId: s.id,
          });
        }
      }
    });

    // RULE 4: Out of Bounds Operator
    const outOfBoundsSoldiers = soldiers.filter(s => s.currentZoneId === 'OUT_OF_BOUNDS');
    outOfBoundsSoldiers.forEach(s => {
      suggestions.push({
        id: `rule-oob-${s.id}`,
        type: 'REDISTRIBUTE',
        priority: 'CRITICAL',
        title: 'Operador Fuera de Geocerca',
        description: `El transpondedor de ${s.callsign} indica que ha superado el límite perimetral de seguridad establecido. Posible pérdida de orientación o desvío de curso.`,
        actionableText: `Ordenar reingreso inmediato a ${s.callsign}`,
        sourceSoldierId: s.id,
      });
    });

    // If no negative rules are triggered, provide a balanced operations card
    if (suggestions.length === 0) {
      suggestions.push({
        id: 'rule-balanced',
        type: 'BALANCED',
        priority: 'INFO',
        title: 'Distribución de Personal Optimizada',
        description: 'El modelo de decisión inteligente confirma que todos los perímetros, geocercas y biometrías se encuentran dentro de los parámetros de tolerancia táctica y balance operacional.',
      });
    }

    return suggestions;
  };

  const suggestions = getSuggestions();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 font-mono-military text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Lightbulb className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-tactical text-xs font-bold text-slate-100 uppercase tracking-wider">
            Recomendaciones de Redistribución
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-slate-400 text-[9px] font-bold">
          SISTEMA EXPERTO SDRT
        </span>
      </div>

      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={`p-2.5 rounded-lg border transition-all ${
              s.priority === 'CRITICAL'
                ? 'bg-red-950/20 border-red-500/40'
                : s.priority === 'WARNING'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-emerald-950/10 border-emerald-500/20'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                {s.priority === 'CRITICAL' ? (
                  <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                ) : s.priority === 'WARNING' ? (
                  <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-[11px] uppercase ${
                    s.priority === 'CRITICAL'
                      ? 'text-red-400'
                      : s.priority === 'WARNING'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}>
                    {s.title}
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                    s.priority === 'CRITICAL'
                      ? 'bg-red-950 text-red-400 border-red-900/60'
                      : s.priority === 'WARNING'
                        ? 'bg-amber-950 text-amber-400 border-amber-900/60'
                        : 'bg-emerald-950 text-emerald-400 border-emerald-900/60'
                  }`}>
                    {s.priority}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-normal">
                  {s.description}
                </p>

                {s.actionableText && s.sourceSoldierId && (
                  <button
                    onClick={() => s.sourceSoldierId && onSelectSoldier(s.sourceSoldierId)}
                    className="mt-1.5 w-full py-1 px-2 rounded bg-slate-950/80 hover:bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-200 transition-all flex items-center justify-between gap-1 group"
                  >
                    <span>{s.actionableText}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
