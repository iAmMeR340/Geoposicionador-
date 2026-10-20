import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Soldier, TacticalAlert, TacticalZone, TacticalBaseMetrics } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import { 
  Globe, 
  Activity, 
  ShieldCheck, 
  Clock, 
  Battery, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert,
  Award
} from 'lucide-react';

interface MetricsDashboardViewProps {
  soldiers: Soldier[];
  alerts: TacticalAlert[];
  zones: TacticalZone[];
  metrics: TacticalBaseMetrics;
}

export const MetricsDashboardView: React.FC<MetricsDashboardViewProps> = ({
  soldiers,
  alerts,
  zones,
  metrics,
}) => {
  // Zone personnel distribution
  const zoneDistribution = zones.map((z) => {
    const count = soldiers.filter((s) => s.currentZoneId === z.id).length;
    return {
      name: z.code.replace('SEC-', ''),
      fullName: z.name,
      personnel: count,
      color: z.color,
    };
  });

  // Alert categories distribution
  const alertTypesCount = [
    { name: 'Impacto / Caída', count: alerts.filter((a) => a.type === 'HOMBRE_CAIDO').length || 1, color: '#ef4444' },
    { name: 'Taquicardia', count: alerts.filter((a) => a.type === 'TAQUICARDIA_EXTREMA' || a.type === 'BIOMETRICO_CRITICO').length || 1, color: '#f59e0b' },
    { name: 'Geocerca / Riesgo', count: alerts.filter((a) => a.type === 'ZONA_ALTO_RIESGO').length || 1, color: '#06b6d4' },
    { name: 'Batería / Señal', count: alerts.filter((a) => a.type === 'BATERIA_BAJA' || a.type === 'PERDIDA_SENAL').length || 1, color: '#8b5cf6' },
  ];

  // Battery health buckets
  const batteryData = [
    { range: '90-100%', count: soldiers.filter((s) => s.device.batteryLevel >= 90).length },
    { range: '75-89%', count: soldiers.filter((s) => s.device.batteryLevel >= 75 && s.device.batteryLevel < 90).length },
    { range: '50-74%', count: soldiers.filter((s) => s.device.batteryLevel >= 50 && s.device.batteryLevel < 75).length },
    { range: '<50%', count: soldiers.filter((s) => s.device.batteryLevel < 50).length },
  ];

  // Tactical Readiness Radar Data
  const readinessRadar = [
    { subject: 'Cobertura GPS', A: metrics.perimeterCoverageScore, fullMark: 100 },
    { subject: 'Estabilidad Vital', A: Math.max(60, 100 - (alerts.filter(a => !a.resolved).length * 15)), fullMark: 100 },
    { subject: 'Seguridad E2EE', A: metrics.networkIntegrity, fullMark: 100 },
    { subject: 'Baterías Vestibles', A: 88, fullMark: 100 },
    { subject: 'Tiempo Respuesta', A: 92, fullMark: 100 },
  ];

  // Calculate current average squad fatigue
  const avgCurrentFatigue = soldiers.length > 0 
    ? Math.round(soldiers.reduce((sum, s) => sum + s.vitals.fatigueLevel, 0) / soldiers.length)
    : 45;

  // Generate 24-Hour Fatigue Trend Data (Military Shift Cycles)
  const generate24hFatigueData = () => {
    const hours = [
      '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', 
      '02:00', '04:00', '06:00', '08:00', '10:00', '12:00'
    ];
    
    // Create base fatigue levels that follow circadian/patrol load profiles
    const baseCurve = [42, 55, 68, 60, 48, 52, 65, 78, 40, 32, 38, avgCurrentFatigue];
    
    return hours.map((hour, idx) => {
      const value = baseCurve[idx];
      return {
        time: `${hour} H`,
        fatigue: Math.min(100, Math.max(10, value)),
      };
    });
  };
  
  const fatigueTrendData = generate24hFatigueData();

  // Generate 60-Minute Aggregated SpO2 and Heart Rate Sparkline Trend Data
  const generate60MinBiometricTrend = () => {
    const data = [];
    const now = new Date();

    const baseHr = soldiers.length > 0
      ? Math.round(soldiers.reduce((acc, s) => acc + s.vitals.heartRate, 0) / soldiers.length)
      : 78;
    const baseSpO2 = soldiers.length > 0
      ? Math.round(soldiers.reduce((acc, s) => acc + s.vitals.oxygenSaturation, 0) / soldiers.length)
      : 97;

    for (let i = 60; i >= 0; i -= 5) {
      const timeObj = new Date(now.getTime() - i * 60 * 1000);
      const timeFull = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Realistic military shift fluctuations over 60 minutes
      const hrVariation = Math.sin((60 - i) / 8) * 8 + Math.cos((60 - i) / 4) * 4;
      const spO2Variation = Math.cos((60 - i) / 12) * 1.5;

      data.push({
        time: i === 0 ? 'Ahora' : `-${i}m`,
        timeFull,
        avgHeartRate: Math.max(60, Math.min(150, Math.round(baseHr + hrVariation))),
        avgSpO2: Math.max(90, Math.min(100, Math.round((baseSpO2 + spO2Variation) * 10) / 10)),
      });
    }
    return data;
  };

  const biometric60MinTrendData = generate60MinBiometricTrend();

  const exportReportJson = () => {
    const data = {
      base: 'Base Militar Vigilancia Táctica C4I',
      exportTimestamp: new Date().toISOString(),
      metrics,
      activePersonnel: soldiers,
      recentAlerts: alerts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SITREP_METRICS_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReportPdf = () => {
    // 1. Initialize jsPDF instance
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const docWidth = doc.internal.pageSize.getWidth(); // 210
    const docHeight = doc.internal.pageSize.getHeight(); // 297

    // --- HELPER DRAWING FUNCTIONS ---
    
    // Draw Military Border / Decorative lines
    const drawPageBorders = (pageNo: number) => {
      doc.setDrawColor(30, 41, 59); // slate-800 (#1e293b)
      doc.setLineWidth(0.4);
      // Outer border margin of 10mm
      doc.rect(10, 10, docWidth - 20, docHeight - 20);
      
      // Top accent double line
      doc.line(10, 22, docWidth - 10, 22);
      
      // Bottom footer text
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`AEGISBASE C4I - COVEÑAS | REPORTE OFICIAL DE MANDOS`, 15, docHeight - 13);
      doc.text(`CLASIFICACIÓN: SECRETO // SOLO PARA USO OFICIAL`, docWidth / 2, docHeight - 13, { align: 'center' });
      doc.text(`Pág. ${pageNo}`, docWidth - 20, docHeight - 13);
    };

    // --- PAGE 1: COVER & SITREP OVERVIEW ---
    drawPageBorders(1);

    // Header Titles
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('REPORTE TÁCTICO DE TELEMETRÍA Y ALERTAS C4I', 15, 30);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`CÓDIGO: REP-TAC-C4I-20260916 | EMISIÓN: 16-SEP-2026 12:58:01 (HORA LOCAL)`, 15, 36);

    // Secret banner
    doc.setFillColor(239, 68, 68); // red-500
    doc.rect(15, 42, docWidth - 30, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('DE USO OFICIAL ESTRICTO - CLASIFICACIÓN DE SEGURIDAD: SECRETO // NO DIVULGAR', docWidth / 2, 47, { align: 'center' });

    // Metadata details block
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(15, 55, docWidth - 30, 32, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('PUESTO DE MANDO:', 20, 61);
    doc.text('INSTALACIÓN:', 20, 67);
    doc.text('SOLICITANTE:', 20, 73);
    doc.text('MÓDULO DE SERVICIO:', 20, 79);
    doc.text('PROTOCOLO TÁCTICO:', 20, 85);

    doc.setFont('Helvetica', 'normal');
    doc.text('Centro de Control AegisBase C4I', 62, 61);
    doc.text('Base de Entrenamiento de Infantería de Marina de Coveñas', 62, 67);
    doc.text('elkinriascos@gmail.com', 62, 73);
    doc.text('Vigilancia de Telemetría Vestible & Alarmas en Tiempo Real', 62, 79);
    doc.text('DEFCON 2 - Enlace Satelital Encriptado con Escuadras en Campo', 62, 85);

    // Section I: Resumen Operativo
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('I. RESUMEN DEL ESTADO OPERATIVO (SITREP - ÚLTIMAS 24 HORAS)', 15, 96);
    doc.line(15, 98, docWidth - 15, 98);

    const kpis = [
      { label: 'Efectivo en Campo', val: `${metrics.totalPersonnel} Operadores` },
      { label: 'Patrullas Activas', val: `${metrics.activePatrols} Escuadras` },
      { label: 'Alertas Críticas Activas', val: `${metrics.alertsCritical} incidentes` },
      { label: 'Alertas Preventivas Activas', val: `${metrics.alertsWarning} advertencias` },
      { label: 'Integridad E2EE de Red', val: `${metrics.networkIntegrity}% Seguro` },
      { label: 'Frecuencia Cardíaca Promedio', val: `${metrics.averageHeartRate} BPM` },
      { label: 'Saturación SpO2 Promedio', val: `${metrics.averageSpO2}% SpO2` },
      { label: 'Tiempo de Respuesta Promedio', val: `${metrics.averageResponseTimeSec} Segundos` },
    ];

    const currentY = 104;
    kpis.forEach((kpi, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const xPos = col === 0 ? 15 : (docWidth / 2) + 2;
      const yPos = currentY + (row * 14);

      // Card bg
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(xPos, yPos, (docWidth / 2) - 17, 11, 'F');
      
      // Color accent bar
      if (idx === 2 && metrics.alertsCritical > 0) {
        doc.setFillColor(239, 68, 68); // Red
      } else if (idx === 4) {
        doc.setFillColor(16, 185, 129); // Green
      } else {
        doc.setFillColor(71, 85, 105); // Slate
      }
      doc.rect(xPos, yPos, 2, 11, 'F');

      // Card texts
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(kpi.label.toUpperCase(), xPos + 5, yPos + 4.5);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(kpi.val, xPos + 5, yPos + 9.5);
    });

    // Section II: 24h fatigue analysis
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('II. ANÁLISIS DE RESISTENCIA Y FATIGA TÁCTICA (CICLO 24 HORAS)', 15, 169);
    doc.line(15, 171, docWidth - 15, 171);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(
      'Análisis continuo de carga fisiológica y ciclos de patrulla del personal en las últimas 24 horas de operación continua en la base de Coveñas. Los picos de esfuerzo físico corresponden a turnos rotativos en Sector de Selva ECHO y Sector de Playa CHARLIE.',
      15,
      176,
      { maxWidth: docWidth - 30 }
    );

    const fatigueRows = fatigueTrendData.map((d) => [
      d.time,
      `${d.fatigue}%`,
      d.fatigue > 70 ? 'RIESGO CRÍTICO' : d.fatigue > 50 ? 'ESFUERZO ELEVADO' : 'RANGO ESTABLE NORMAL'
    ]);
    
    autoTable(doc, {
      startY: 185,
      head: [['Intervalo de Tiempo (Turno)', 'Índice de Fatiga Grupal Promedio', 'Estado de Alerta Fisiológica']],
      body: fatigueRows,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 15, right: 15 },
    });

    // Add Page 2
    doc.addPage();
    drawPageBorders(2);

    // Section III: Operators Inventary
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('III. INVENTARIO ACTUAL DE TELEMETRÍA DE OPERADORES EN TIEMPO REAL', 15, 26);
    doc.line(15, 28, docWidth - 15, 28);

    const operatorRows = soldiers.map((s) => [
      s.callsign,
      `${s.rank} ${s.name}`,
      s.role,
      s.squad.replace(' (Vanguardia)', '').replace(' (Reconocimiento)', '').replace(' (Perímetro)', ''),
      s.status,
      `${s.vitals.heartRate} BPM`,
      `${s.vitals.oxygenSaturation}%`,
      `${s.vitals.temperature}°C`,
      s.vitals.stressLevel,
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Indicativo', 'Personal / Rango', 'Especialidad', 'Escuadra', 'Estado', 'Pulsos', 'Saturación', 'Temp', 'Estrés']],
      body: operatorRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 32 },
        2: { cellWidth: 26 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18 },
        5: { cellWidth: 14 },
        6: { cellWidth: 15 },
        7: { cellWidth: 13 },
        8: { cellWidth: 14 },
      },
      margin: { left: 15, right: 15 },
    });

    // Section IV: Incident Log
    let alertsStartY = (doc as any).lastAutoTable?.finalY + 12 || 140;

    if (alertsStartY > docHeight - 75) {
      doc.addPage();
      drawPageBorders(3);
      alertsStartY = 26;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('IV. HISTORIAL DE INCIDENTES Y LOG DE ALERTAS REGISTRADAS', 15, alertsStartY);
    doc.line(15, alertsStartY + 2, docWidth - 15, alertsStartY + 2);

    const alertRows = alerts.map((a) => [
      a.timestamp,
      a.soldierCallsign,
      a.type.replace(/_/g, ' '),
      a.severity,
      a.title,
      a.resolved ? 'RESOLVIDA' : a.acknowledged ? 'RECONOCIDA' : 'CRÍTICA EN CURSO',
    ]);

    autoTable(doc, {
      startY: alertsStartY + 6,
      head: [['Hora', 'Operador', 'Categoría', 'Severidad', 'Mensaje de Incidente', 'Estado']],
      body: alertRows.length > 0 ? alertRows : [['-', '-', '-', '-', 'No se registran alertas tácticas activas', '-']],
      theme: 'striped',
      headStyles: {
        fillColor: [185, 28, 28], // red-700
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 28 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18 },
        4: { cellWidth: 68 },
        5: { cellWidth: 23 },
      },
      margin: { left: 15, right: 15 },
    });

    // Section V: Signature and Stamp
    let signStartY = (doc as any).lastAutoTable?.finalY + 12 || docHeight - 50;
    
    if (signStartY > docHeight - 45) {
      doc.addPage();
      drawPageBorders(3);
      signStartY = 40;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('V. VALIDACIÓN OPERACIONAL DEL REPORTE', 15, signStartY);
    doc.line(15, signStartY + 2, docWidth - 15, signStartY + 2);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(
      'Este informe ha sido compilado digitalmente por el sistema de monitorización AegisBase C4I mediante encriptación E2EE de extremo a extremo, resguardando la integridad biométrica y posicional de la Infantería de Marina de Coveñas.',
      15,
      signStartY + 7,
      { maxWidth: docWidth - 30 }
    );

    const lineY = signStartY + 26;
    
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.line(25, lineY, 85, lineY);
    doc.line(125, lineY, 185, lineY);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('OFICIAL DE OPERACIONES C4I', 55, lineY + 4, { align: 'center' });
    doc.text('COMANDANTE DEL PUESTO DE MANDO', 155, lineY + 4, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('SISTEMA AUTOMÁTICO AEGISBASE', 55, lineY + 8, { align: 'center' });
    doc.text('INFANTERÍA DE MARINA - COVEÑAS', 155, lineY + 8, { align: 'center' });

    // Save/Download PDF
    doc.save(`REPORTE_TACTICO_COVENAS_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner with Export & High-level KPIs */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-tactical text-lg font-bold text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span className="text-shadow-tactical">PANEL DE CONTROL & MÉTRICAS DE DESEMPEÑO OPERATIVO</span>
          </h2>
          <p className="text-xs text-slate-300">
            Rendimiento del dispositivo en campo, cumplimiento de patrulla y telemetría médica consolidada
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            id="btn-export-pdf"
            onClick={exportReportPdf}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-bold font-mono-military text-xs shadow-lg shadow-red-950 transition-all cursor-pointer active:scale-95"
            title="Generar y descargar reporte oficial en PDF para mandos"
          >
            <Download className="w-4 h-4" />
            <span>Generar Reporte de Mando (PDF)</span>
          </button>

          <button
            id="btn-export-metrics"
            onClick={exportReportJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold font-mono-military text-xs shadow-lg shadow-emerald-950 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Informe SITREP (.JSON)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Perimeter Coverage */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono-military text-slate-400">COBERTURA PERIMETRAL</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono-military text-emerald-400 mb-1">
            {metrics.perimeterCoverageScore}%
          </p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">&uarr; +4.2%</span> vs turno anterior
          </p>
        </div>

        {/* Avg Response Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono-military text-slate-400">TIEMPO RESPUESTA INCIDENTES</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono-military text-cyan-400 mb-1">
            {metrics.averageResponseTimeSec} <span className="text-sm font-normal text-slate-400">seg</span>
          </p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">Excelente</span> (Meta &lt; 60s)
          </p>
        </div>

        {/* E2EE Data Throughput */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono-military text-slate-400">INTEGRIDAD E2EE EN NUBE</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono-military text-purple-400 mb-1">
            {metrics.networkIntegrity}%
          </p>
          <p className="text-[11px] text-slate-400">
            {metrics.e2eePacketsSec} paquetes/seg cifrados en tránsito
          </p>
        </div>

        {/* Biometric Squad Stability */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono-military text-slate-400">PROMEDIO VITALES ESCUADRA</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono-military text-slate-100 mb-1">
            {metrics.averageHeartRate} <span className="text-sm font-normal text-slate-400">BPM / {metrics.averageSpO2}% O2</span>
          </p>
          <p className="text-[11px] text-slate-400">
            {alerts.filter(a => !a.resolved).length} operadores requieren atención médica
          </p>
        </div>

      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Radar Readiness Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>ÍNDICE DE PREPARACIÓN TÁCTICA & VIGILANCIA</span>
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={readinessRadar} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <PolarRadiusAxis stroke="#475569" angle={30} domain={[0, 100]} />
                <Radar name="Nivel Táctico" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Personnel Distribution by Geofence Zone */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>DENSIDAD DE OPERADORES POR SECTOR DE BASE</span>
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Bar dataKey="personnel" name="Operadores en Zona" radius={[4, 4, 0, 0]}>
                  {zoneDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 60-Minute Aggregated SpO2 & Heart Rate Sparkline Trend Chart */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-shadow-tactical">TENDENCIA AGREGADA SpO2 Y FRECUENCIA CARDÍACA (ÚLTIMOS 60 MINUTOS)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono-military font-bold border border-emerald-500/40 ml-1">
                EN TIEMPO REAL
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Monitoreo biomecánico continuo: Promedio ponderado de saturación de oxígeno (SpO2 %) y pulsaciones por minuto (BPM)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono-military">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
              <span className="w-3 h-1 bg-emerald-400 rounded-full"></span>
              <span className="text-slate-200 font-bold">Frecuencia Cardíaca (BPM)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
              <span className="w-3 h-1 bg-cyan-400 rounded-full"></span>
              <span className="text-slate-200 font-bold">Saturación SpO2 (%)</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={biometric60MinTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis yAxisId="left" stroke="#10b981" domain={[50, 160]} tick={{ fill: '#10b981', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" domain={[88, 100]} tick={{ fill: '#06b6d4', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b1329',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontFamily: 'JetBrains Mono',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                }}
                formatter={(value: any, name: string) => [
                  name === 'avgHeartRate' ? `${value} BPM` : `${value}% SpO2`,
                  name === 'avgHeartRate' ? 'Frecuencia Cardíaca Promedio' : 'Saturación SpO2 Promedio',
                ]}
                labelFormatter={(label, items) => {
                  const item = items[0]?.payload;
                  return `Intervalo: ${label} (${item?.timeFull || ''})`;
                }}
              />
              <ReferenceLine yAxisId="right" y={92} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Límite Crítico SpO2 (92%)', fill: '#f87171', fontSize: 10, position: 'insideBottomRight' }} />
              <ReferenceLine yAxisId="left" y={130} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Umbral Taquicardia (130 BPM)', fill: '#fbbf24', fontSize: 10, position: 'insideTopLeft' }} />
              <Line yAxisId="left" type="monotone" dataKey="avgHeartRate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 6 }} name="avgHeartRate" />
              <Line yAxisId="right" type="monotone" dataKey="avgSpO2" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, fill: '#06b6d4' }} activeDot={{ r: 6 }} name="avgSpO2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 24-Hour Personnel Fatigue Trend Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-400" />
              <span>TENDENCIA DE FATIGA DE LA ESCUADRA (ÚLTIMAS 24 HORAS)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Índice acumulado de cansancio y estrés fisiológico (fatigueLevel) basado en parámetros biomecánicos combinados
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-military">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-rose-500 rounded-full opacity-30" />
              <span className="text-slate-300">Fatiga Promedio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-t-2 border-dashed border-red-500" />
              <span className="text-red-400 font-bold">Límite Agotamiento (75%)</span>
            </div>
            <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400">Promedio Actual:</span>{' '}
              <span className={`font-bold ${avgCurrentFatigue > 70 ? 'text-red-400' : 'text-emerald-400'}`}>
                {avgCurrentFatigue}%
              </span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fatigueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fatigueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
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
              <Area
                type="monotone"
                dataKey="fatigue"
                name="Nivel de Fatiga (%)"
                stroke="#f43f5e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#fatigueGrad)"
              />
              <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Límite Fatiga (75%)', fill: '#ef4444', fontSize: 10, position: 'top' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts: Alert Types & Battery Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Alert Types Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>DESGLOSE DE INCIDENTES & ALERTAS TEMPRANAS</span>
          </h3>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={alertTypesCount}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {alertTypesCount.map((entry, index) => (
                    <Cell key={`alert-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontFamily: 'JetBrains Mono',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Battery Distribution Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <Battery className="w-4 h-4 text-emerald-400" />
            <span>ESTADO DE AUTONOMÍA DE DISPOSITIVOS VESTIBLES</span>
          </h3>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batteryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Bar dataKey="count" name="Dispositivos" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
