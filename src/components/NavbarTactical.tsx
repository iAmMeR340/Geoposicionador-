import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Radio, 
  Bell, 
  Volume2, 
  VolumeX, 
  Lock, 
  Activity, 
  Navigation, 
  Sparkles, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw,
  Zap,
  Mountain,
  Globe,
  EyeOff,
  BellRing,
  HelpCircle
} from 'lucide-react';
import { tacticalAudio } from '../utils/audioAlerts';
import { requestPushPermission, isPushPermissionGranted, sendPersistentNotification } from '../utils/pushNotificationService';

interface NavbarTacticalProps {
  activeTab: 'map' | '3dmap' | 'telemetry' | 'metrics' | 'e2ee';
  setActiveTab: (tab: 'map' | '3dmap' | 'telemetry' | 'metrics' | 'e2ee') => void;
  unreadAlertsCount: number;
  isSimulating: boolean;
  setIsSimulating: (val: boolean) => void;
  onOpenSitrep: () => void;
  onOpenAlerts: () => void;
  onOpenComms: () => void;
  onTriggerTestEmergency: () => void;
  onToggleUserGps: () => void;
  isUserGpsActive: boolean;
  onTriggerBlackout: () => void;
  onOpenOnboarding: () => void;
  onOpenZoneConfigurator?: () => void;
}

export const NavbarTactical: React.FC<NavbarTacticalProps> = ({
  activeTab,
  setActiveTab,
  unreadAlertsCount,
  isSimulating,
  setIsSimulating,
  onOpenSitrep,
  onOpenAlerts,
  onOpenComms,
  onTriggerTestEmergency,
  onToggleUserGps,
  isUserGpsActive,
  onTriggerBlackout,
  onOpenOnboarding,
  onOpenZoneConfigurator,
}) => {
  const [zuluTime, setZuluTime] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(() => isPushPermissionGranted());

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      setZuluTime(now.toISOString().substring(11, 19) + ' ZULU');
      setLocalTime(now.toLocaleTimeString('es-ES', { hour12: false }));
    };
    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    tacticalAudio.isMuted = !isMuted;
    setIsMuted(!isMuted);
    if (isMuted) {
      tacticalAudio.playRadioRoger();
    }
  };

  const requestBrowserNotifications = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      setNotificationsGranted(true);
      await sendPersistentNotification('🔊 AegisBase C4I - Web Push Activo', {
        body: 'Alertas persistentes de segundo plano habilitadas para Hombre Caído, Geofence y Radar de Proximidad.',
        tag: 'c4i-push-enabled',
      });
    }
  };

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 text-slate-100 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1750px] mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Brand & Military Base Info */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-500/50 shadow-lg shadow-emerald-950/50">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-tactical text-lg sm:text-xl font-bold tracking-wider text-slate-100 flex items-center gap-1.5">
                AEGIS<span className="text-emerald-400">BASE</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono-military font-normal">
                  C4I MIL-SPEC
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-military flex items-center gap-2">
              <span>BASE VIGILANCIA TÁCTICA</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-medium">DEFCON 2</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400">{zuluTime || '00:00:00 Z'}</span>
            </p>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            id="nav-tab-map"
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'map'
                ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mapa 2D</span>
            <span className="sm:hidden">2D</span>
          </button>

          <button
            id="nav-tab-3dmap"
            onClick={() => setActiveTab('3dmap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === '3dmap'
                ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terreno 3D & Globo</span>
            <span className="sm:hidden">3D</span>
          </button>

          <button
            id="nav-tab-telemetry"
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'telemetry'
                ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telemetría Salud</span>
            <span className="sm:hidden">Salud</span>
          </button>

          <button
            id="nav-tab-metrics"
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'metrics'
                ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Métricas & Rendimiento</span>
            <span className="sm:hidden">Métricas</span>
          </button>

          <button
            id="nav-tab-e2ee"
            onClick={() => setActiveTab('e2ee')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'e2ee'
                ? 'bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Seguridad E2EE</span>
            <span className="sm:hidden">E2EE</span>
          </button>
        </nav>

        {/* Right: Operational Controls & AI SITREP */}
        <div className="flex items-center gap-2">
          
          {/* Emergency Blackout Mode Button */}
          <button
            id="btn-trigger-blackout"
            onClick={onTriggerBlackout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950 text-red-400 hover:text-red-200 text-xs font-bold tracking-wider border border-red-900/60 transition-transform active:scale-95"
            title="Activar MODO BLACKOUT inmediato (Seguridad visual de pantalla)"
          >
            <EyeOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span className="hidden sm:inline">Blackout</span>
          </button>
          
          {/* Quick Start Guide Button */}
          <button
            id="btn-open-onboarding"
            onClick={onOpenOnboarding}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-mono-military border border-emerald-500/40 transition-colors"
            title="Abrir Guía de Inicio Rápido C4I"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Guía Rápida</span>
          </button>

          {/* Security Zones & Patrol Configurator Button */}
          {onOpenZoneConfigurator && (
            <button
              id="btn-open-zones"
              onClick={onOpenZoneConfigurator}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 hover:text-white text-xs font-mono-military font-bold border border-emerald-500/40 transition-transform active:scale-95 shadow-md shadow-emerald-950"
              title="Ajustar Zonas de Seguridad y Registrar Patrullajes"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Zonas & Patrullas</span>
            </button>
          )}

          {/* AI SITREP Generator Button */}
          <button
            id="btn-ai-sitrep"
            onClick={onOpenSitrep}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold tracking-wider shadow-lg shadow-cyan-900/30 border border-cyan-400/30 transition-transform active:scale-95"
            title="Generar SITREP y análisis táctico con IA Gemini"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            <span className="hidden md:inline">SITREP IA</span>
          </button>

          {/* Test Emergency Trigger for Real-Time Demo */}
          <button
            id="btn-test-emergency"
            onClick={onTriggerTestEmergency}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 hover:text-red-200 text-xs font-mono-military border border-red-800/60 transition-colors"
            title="Simular Incursión / Emergencia Biométrica"
          >
            <Zap className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden lg:inline">Simular Alerta SOS</span>
          </button>

          {/* Real GPS Toggle */}
          <button
            id="btn-user-gps"
            onClick={onToggleUserGps}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono-military border transition-colors ${
              isUserGpsActive
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-700'
            }`}
            title="Vincular mi ubicación GPS real a la escuadra"
          >
            <Navigation className={`w-3.5 h-3.5 ${isUserGpsActive ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span className="hidden xl:inline">{isUserGpsActive ? 'GPS Real: ON' : 'GPS Real'}</span>
          </button>

          {/* Simulation Play / Pause */}
          <button
            id="btn-toggle-sim"
            onClick={() => setIsSimulating(!isSimulating)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isSimulating
                ? 'bg-slate-900 text-emerald-400 border-emerald-500/30 hover:bg-slate-800'
                : 'bg-slate-900 text-amber-400 border-amber-500/30 hover:bg-slate-800'
            }`}
            title={isSimulating ? 'Pausar Simulación en Vivo' : 'Reanudar Simulación'}
          >
            {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Audio Mute / Unmute */}
          <button
            id="btn-toggle-audio"
            onClick={toggleMute}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title={isMuted ? 'Activar Sonidos Tácticos' : 'Silenciar Alarmas'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Persistent Web Push SW Button */}
          <button
            id="btn-request-push"
            onClick={requestBrowserNotifications}
            className={`p-1.5 rounded-lg border transition-colors ${
              notificationsGranted
                ? 'bg-slate-900 text-emerald-400 border-emerald-500/40 hover:bg-slate-800'
                : 'bg-amber-950/40 text-amber-400 border-amber-600/50 hover:bg-amber-900/60'
            }`}
            title={notificationsGranted ? 'Notificaciones Push SW Activas (Segundo Plano)' : 'Habilitar Notificaciones Push SW para Hombre Caído y Geofence'}
          >
            <BellRing className={`w-4 h-4 ${notificationsGranted ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
          </button>

          {/* Tactical Comms Drawer Button */}
          <button
            id="btn-open-comms"
            onClick={onOpenComms}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 relative transition-colors"
            title="Canal de Radio & Mensajes Tácticos"
          >
            <Radio className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Alerts Counter Button */}
          <button
            id="btn-open-alerts"
            onClick={onOpenAlerts}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 relative transition-colors"
            title="Ver Panel de Alertas Push"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-slate-100 text-[10px] font-bold font-mono-military animate-pulse">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
