import { Soldier, BreadcrumbPoint } from '../types';

export interface LinearRegressionResult {
  slope: number; // Rate of change per minute (e.g. +0.35 BPM/min)
  intercept: number;
  r2: number; // Coefficient of determination (0 to 1)
  projectedValue15m: number;
  projectedValue30m: number;
  projectedValue60m: number;
}

export interface FatiguePredictionAnalysis {
  soldierId: string;
  soldierCallsign: string;
  soldierName: string;
  rank: string;
  squad: string;
  currentHR: number;
  currentSpO2: number;
  currentFatigueScore: number;
  
  // Linear Regression Metrics (2h window)
  hrRegression: LinearRegressionResult;
  spo2Regression: LinearRegressionResult;
  
  // Projections
  timeToCollapseMinutes: number | null; // Estimated minutes until HR >= 165 or SpO2 <= 90%
  predictedCollapseTimeStr: string | null; // e.g. "+24 min (10:45 ZULU)"
  primaryRiskFactor: 'CARDIOVASCULAR' | 'HIPOXIA' | 'ESTABLE' | 'COMBINADO';
  
  // Risk Tier
  riskLevel: 'ESTABLE' | 'MODERADO' | 'ALTO' | 'COLAPSO_INMINENTE';
  riskScore: number; // 0 to 100%
  
  // Tactical Recommendation
  recommendation: string;
  mitigationProtocol: string[];
}

/**
  * Calculate simple linear regression on a series of (x, y) points
  * x: time in minutes (0 to 120)
  * y: biometric reading (BPM or SpO2)
  */
export function calculateLinearRegression(points: { x: number; y: number }[]): LinearRegressionResult {
  const n = points.length;
  if (n < 2) {
    const lastY = n === 1 ? points[0].y : 0;
    return {
      slope: 0,
      intercept: lastY,
      r2: 1,
      projectedValue15m: lastY,
      projectedValue30m: lastY,
      projectedValue60m: lastY,
    };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) {
    const avgY = sumY / n;
    return {
      slope: 0,
      intercept: avgY,
      r2: 0,
      projectedValue15m: avgY,
      projectedValue30m: avgY,
      projectedValue60m: avgY,
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R^2
  const meanY = sumY / n;
  let totalSS = 0;
  let resSS = 0;
  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    const predY = slope * x + intercept;
    totalSS += Math.pow(y - meanY, 2);
    resSS += Math.pow(y - predY, 2);
  }

  const r2 = totalSS > 0 ? Math.max(0, Math.min(1, 1 - resSS / totalSS)) : 1;

  const currentX = points[points.length - 1].x;

  return {
    slope,
    intercept,
    r2,
    projectedValue15m: Number((slope * (currentX + 15) + intercept).toFixed(1)),
    projectedValue30m: Number((slope * (currentX + 30) + intercept).toFixed(1)),
    projectedValue60m: Number((slope * (currentX + 60) + intercept).toFixed(1)),
  };
}

/**
  * Analyze 2-hour biometric trajectory for a soldier and compute fatigue & collapse prediction
  */
export function analyzeSoldierFatigue(soldier: Soldier): FatiguePredictionAnalysis {
  const history = soldier.routeHistory && soldier.routeHistory.length > 0 
    ? soldier.routeHistory 
    : [
        { lat: soldier.location.lat, lng: soldier.location.lng, timestamp: '00:00:00', hr: soldier.vitals.heartRate, spo2: soldier.vitals.oxygenSaturation }
      ];

  // Convert history to relative time points in minutes (e.g. 0 to 120 min)
  const totalPoints = history.length;
  const timeStepMinutes = Math.max(1, 120 / Math.max(1, totalPoints - 1));

  const hrPoints: { x: number; y: number }[] = [];
  const spo2Points: { x: number; y: number }[] = [];

  history.forEach((pt, idx) => {
    const xMinutes = idx * timeStepMinutes;
    // Add realistic physiological noise or trend if history is short
    let hr = pt.hr || soldier.vitals.heartRate;
    let spo2 = pt.spo2 || soldier.vitals.oxygenSaturation;

    hrPoints.push({ x: xMinutes, y: hr });
    spo2Points.push({ x: xMinutes, y: spo2 });
  });

  const hrReg = calculateLinearRegression(hrPoints);
  const spo2Reg = calculateLinearRegression(spo2Points);

  const currentHR = soldier.vitals.heartRate;
  const currentSpO2 = soldier.vitals.oxygenSaturation;

  // Calculate Time to Collapse (HR >= 165 BPM or SpO2 <= 90%)
  const CRITICAL_HR_LIMIT = 165;
  const CRITICAL_SPO2_LIMIT = 90;

  let hrTimeToCollapse: number | null = null;
  if (currentHR >= CRITICAL_HR_LIMIT) {
    hrTimeToCollapse = 0;
  } else if (hrReg.slope > 0.05) {
    hrTimeToCollapse = Math.max(1, Math.round((CRITICAL_HR_LIMIT - currentHR) / hrReg.slope));
  }

  let spo2TimeToCollapse: number | null = null;
  if (currentSpO2 <= CRITICAL_SPO2_LIMIT) {
    spo2TimeToCollapse = 0;
  } else if (spo2Reg.slope < -0.02) {
    spo2TimeToCollapse = Math.max(1, Math.round((currentSpO2 - CRITICAL_SPO2_LIMIT) / Math.abs(spo2Reg.slope)));
  }

  // Combine collapse time
  let timeToCollapse: number | null = null;
  let primaryRisk: 'CARDIOVASCULAR' | 'HIPOXIA' | 'ESTABLE' | 'COMBINADO' = 'ESTABLE';

  if (hrTimeToCollapse !== null && spo2TimeToCollapse !== null) {
    timeToCollapse = Math.min(hrTimeToCollapse, spo2TimeToCollapse);
    if (Math.abs(hrTimeToCollapse - spo2TimeToCollapse) < 10) primaryRisk = 'COMBINADO';
    else primaryRisk = hrTimeToCollapse < spo2TimeToCollapse ? 'CARDIOVASCULAR' : 'HIPOXIA';
  } else if (hrTimeToCollapse !== null) {
    timeToCollapse = hrTimeToCollapse;
    primaryRisk = 'CARDIOVASCULAR';
  } else if (spo2TimeToCollapse !== null) {
    timeToCollapse = spo2TimeToCollapse;
    primaryRisk = 'HIPOXIA';
  }

  // Determine Risk Tier
  let riskLevel: 'ESTABLE' | 'MODERADO' | 'ALTO' | 'COLAPSO_INMINENTE' = 'ESTABLE';
  let riskScore = 15; // default base

  if (timeToCollapse !== null && timeToCollapse <= 20) {
    riskLevel = 'COLAPSO_INMINENTE';
    riskScore = Math.min(99, 90 + (20 - timeToCollapse));
  } else if ((timeToCollapse !== null && timeToCollapse <= 45) || currentHR > 145 || currentSpO2 < 93 || hrReg.slope > 0.35) {
    riskLevel = 'ALTO';
    riskScore = 75;
  } else if ((timeToCollapse !== null && timeToCollapse <= 90) || currentHR > 125 || currentSpO2 < 95 || hrReg.slope > 0.15) {
    riskLevel = 'MODERADO';
    riskScore = 45;
  } else {
    riskLevel = 'ESTABLE';
    riskScore = 20;
  }

  // Recommendations & Mitigations
  let recommendation = 'Patrón biométrico estable. Continuar vigilancia de rutina.';
  let mitigationProtocol: string[] = [
    'Mantener ritmo de marcha estándar.',
    'Monitoreo pasivo de telemetría biométrica E2EE.'
  ];

  if (riskLevel === 'COLAPSO_INMINENTE') {
    recommendation = `🚨 ALERTA CRÍTICA: Deriva acelerada hacia colapso en ~${timeToCollapse || 10} min. Acción de mando urgente requerida.`;
    mitigationProtocol = [
      '🛑 Ordenar alto al fuego / pausa operativa e inmediata detención de marcha.',
      '🔄 Transición inmediata a posición de reposo con sombra táctica.',
      '💧 Protocolo de rehidratación oral y enfriamiento activo de torso.',
      '🚑 Despachar médico de combate o binomio de rescate MEDEVAC.'
    ];
  } else if (riskLevel === 'ALTO') {
    recommendation = `⚠️ Advertencia de fatiga acumulada. Pendiente de aceleración cardíaca (+${hrReg.slope.toFixed(2)} BPM/min).`;
    mitigationProtocol = [
      '🔄 Planificar relevo de vanguardia por escuadra de apoyo en los próximos 15 min.',
      '💧 Suministro obligatorio de hidratación con sales mineralizadas.',
      '📉 Reducir carga táctica y ritmo de desplazamiento.'
    ];
  } else if (riskLevel === 'MODERADO') {
    recommendation = 'Fatiga moderada en progreso. Se recomienda monitorear intervalo de descanso.';
    mitigationProtocol = [
      'Programar pausa táctica de 10 minutos al completar la cota actual.',
      'Verificar oximetría y nivel de hidratación.'
    ];
  }

  // Format projected time string
  let predictedCollapseTimeStr: string | null = null;
  if (timeToCollapse !== null && timeToCollapse < 180) {
    const collapseDate = new Date(Date.now() + timeToCollapse * 60 * 1000);
    const zuluHours = String(collapseDate.getUTCHours()).padStart(2, '0');
    const zuluMins = String(collapseDate.getUTCMinutes()).padStart(2, '0');
    predictedCollapseTimeStr = `+${timeToCollapse} min (${zuluHours}:${zuluMins} ZULU)`;
  }

  return {
    soldierId: soldier.id,
    soldierCallsign: soldier.callsign,
    soldierName: soldier.name,
    rank: soldier.rank,
    squad: soldier.squad,
    currentHR,
    currentSpO2,
    currentFatigueScore: soldier.vitals.fatigueLevel,
    hrRegression: hrReg,
    spo2Regression: spo2Reg,
    timeToCollapseMinutes: timeToCollapse,
    predictedCollapseTimeStr,
    primaryRiskFactor: primaryRisk,
    riskLevel,
    riskScore,
    recommendation,
    mitigationProtocol,
  };
}
