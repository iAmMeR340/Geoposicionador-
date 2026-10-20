import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  MapPin, 
  Activity, 
  Radio, 
  Radar, 
  BellRing, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  Sparkles, 
  EyeOff,
  Navigation,
  Crosshair,
  Heart
} from 'lucide-react';

interface QuickStartOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'map' | 'telemetry' | 'metrics' | 'e2ee') => void;
}

interface TourStep {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  tabTarget?: 'map' | 'telemetry' | 'metrics' | 'e2ee';
  headline: string;
  description: string;
  highlights: string[];
  badgeText: string;
  accentColor: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'intro',
    title: 'Bienvenido a AegisBase C4I',
    category: 'SISTEMA DE MANDO Y CONTROL',
    icon: <Shield className="w-8 h-8 text-emerald-400" />,
    headline: 'Plataforma Táctica Militar de Monitoreo Biométrico en Tiempo Real',
    description: 'AegisBase C4I proporciona vigilancia, rastreo perimetral MGRS y protección fisiológica para patrullas de combate y operadores en campo.',
    highlights: [
      'Seguimiento geodésico de precisión MGRS',
      'Alertas biométricas instantáneas de frecuencia cardíaca y SpO2',
      'Transmisión encriptada de canal táctico E2EE'
    ],
    badgeText: 'PASO 1 DE 4',
    accentColor: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
  },
  {
    id: 'map-radar',
    title: 'Mapa Táctico & Radar de Proximidad',
    category: 'NAVEGACIÓN Y GEOINT',
    icon: <Radar className="w-8 h-8 text-cyan-400" />,
    tabTarget: 'map',
    headline: 'Cartografía Satelital, Geocercas y Radar de Cercanía de Unidades',
    description: 'Visualice la posición de la escuadra, dibuje zonas restringidas y monitoree la distancia de seguridad con el Radar de Proximidad.',
    highlights: [
      'Radar de Proximidad con vectores de alerta cuando dos unidades están a < 100m',
      'Predicción de trayectoria con cono de dispersión geodésico',
      'Fijación de Marcadores Tácticos manuales (+Amenaza / +Obstáculo)'
    ],
    badgeText: 'PASO 2 DE 4',
    accentColor: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300'
  },
  {
    id: 'telemetry',
    title: 'Telemetría Biométrica & ECG',
    category: 'SALUD Y RESCATE',
    icon: <Activity className="w-8 h-8 text-rose-400" />,
    tabTarget: 'telemetry',
    headline: 'Monitoreo Fisiológico Vital y Detección de Hombre Caído',
    description: 'Supervise pulso (BPM), temperatura corporal, nivel de estrés y trazados ECG en tiempo real para prevenir golpes de calor y trauma.',
    highlights: [
      'Detector automático de caídas severas (Hombre Caído con acelerómetro G)',
      'Monitor de ECG en tiempo real con trazado electrocardiógrafo',
      'Estado de estrés metabólico e índice de fatiga del operador'
    ],
    badgeText: 'PASO 3 DE 4',
    accentColor: 'border-rose-500/50 bg-rose-950/20 text-rose-300'
  },
  {
    id: 'dispatch-push',
    title: 'Despacho, Blackout & Alertas Push',
    category: 'OPERACIONES DE SEGUNDO PLANO',
    icon: <BellRing className="w-8 h-8 text-amber-400" />,
    headline: 'Notificaciones Web Push Persistentes y Seguridad de Pantalla',
    description: 'Reciba alertas críticas aun con la pestaña minimizada y proteja la interfaz con el botón de Modo Blackout inmediato.',
    highlights: [
      'Notificaciones Push SW persistentes en segundo plano',
      'Modo Blackout de un clic para ocultar pantalla ante exposición no autorizada',
      'Generador SITREP de Inteligencia Artificial y Radio Canales C4I'
    ],
    badgeText: 'PASO 4 DE 4',
    accentColor: 'border-amber-500/50 bg-amber-950/20 text-amber-300'
  }
];

export const QuickStartOnboarding: React.FC<QuickStartOnboardingProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = TOUR_STEPS[currentStepIndex];

  useEffect(() => {
    if (isOpen && currentStep.tabTarget && onNavigateTab) {
      onNavigateTab(currentStep.tabTarget);
    }
  }, [currentStepIndex, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      if (TOUR_STEPS[nextIndex].tabTarget && onNavigateTab) {
        onNavigateTab(TOUR_STEPS[nextIndex].tabTarget!);
      }
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      if (TOUR_STEPS[prevIndex].tabTarget && onNavigateTab) {
        onNavigateTab(TOUR_STEPS[prevIndex].tabTarget!);
      }
    }
  };

  const handleComplete = () => {
    localStorage.setItem('aegisbase_onboarding_completed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        id="quick-start-guide-modal"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col font-sans text-slate-100 relative"
      >
        {/* Top Header */}
        <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono-military uppercase tracking-wider text-emerald-400">
                GUÍA DE INICIO RÁPIDO C4I
              </h3>
              <p className="text-[10px] text-slate-400 font-mono-military">
                AegisBase Vigilancia Táctica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono-military text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              {currentStepIndex + 1} / {TOUR_STEPS.length}
            </span>
            <button
              id="btn-skip-onboarding"
              onClick={handleComplete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Omitir Guía"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Category Badge & Icon */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold font-mono-military uppercase tracking-wider border ${currentStep.accentColor}`}>
                {currentStep.category} &bull; {currentStep.badgeText}
              </span>
              <h2 className="text-xl font-bold font-mono-military text-slate-100 tracking-tight pt-1">
                {currentStep.title}
              </h2>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner flex-shrink-0">
              {currentStep.icon}
            </div>
          </div>

          {/* Headline */}
          <p className="text-sm font-semibold text-emerald-300 font-mono-military leading-snug">
            {currentStep.headline}
          </p>

          {/* Description */}
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Highlights List */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <p className="text-[10px] font-bold font-mono-military uppercase tracking-wider text-slate-400">
              Capacidades Clave en esta Sección:
            </p>
            <div className="space-y-1.5">
              {currentStep.highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-4">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentStepIndex(idx);
                  if (TOUR_STEPS[idx].tabTarget && onNavigateTab) {
                    onNavigateTab(TOUR_STEPS[idx].tabTarget!);
                  }
                }}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStepIndex 
                    ? 'w-6 bg-emerald-400' 
                    : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                id="btn-prev-step"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono-military flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              id="btn-next-step"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono-military flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950 uppercase"
            >
              <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Finalizar y Entrar' : 'Siguiente'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
