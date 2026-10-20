import React from 'react';
import { Navigation, Activity, Bell } from 'lucide-react';
import { tacticalAudio } from '../utils/audioAlerts';

interface MobileBottomNavProps {
  activeTab: 'map' | '3dmap' | 'telemetry' | 'metrics' | 'e2ee';
  setActiveTab: (tab: 'map' | '3dmap' | 'telemetry' | 'metrics' | 'e2ee') => void;
  isAlertsOpen: boolean;
  setIsAlertsOpen: (open: boolean) => void;
  unreadAlertsCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  isAlertsOpen,
  setIsAlertsOpen,
  unreadAlertsCount,
}) => {
  const handleTabClick = (tab: 'map' | 'telemetry', isAlerts: boolean) => {
    try {
      tacticalAudio.playRadioRoger();
    } catch (e) {}

    if (isAlerts) {
      setIsAlertsOpen(true);
    } else {
      setIsAlertsOpen(false);
      setActiveTab(tab);
    }
  };

  const isMapActive = activeTab === 'map' && !isAlertsOpen;
  const isTelemetryActive = activeTab === 'telemetry' && !isAlertsOpen;
  const isAlertsActive = isAlertsOpen;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-4 py-2 flex items-center justify-around h-16 shadow-2xl safe-bottom"
      id="mobile-bottom-navigation"
    >
      {/* Tab 1: Map */}
      <button
        id="btn-mobile-nav-map"
        onClick={() => handleTabClick('map', false)}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all cursor-pointer relative"
      >
        <Navigation 
          className={`w-5 h-5 transition-transform duration-200 ${
            isMapActive ? 'text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-slate-400'
          }`} 
        />
        <span 
          className={`text-[9px] font-mono-military tracking-wider mt-1 uppercase transition-colors ${
            isMapActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          Mapa
        </span>
        {isMapActive && (
          <span className="absolute bottom-0 w-4 h-0.5 bg-emerald-400 rounded-full" />
        )}
      </button>

      {/* Tab 2: Telemetry */}
      <button
        id="btn-mobile-nav-telemetry"
        onClick={() => handleTabClick('telemetry', false)}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all cursor-pointer relative"
      >
        <Activity 
          className={`w-5 h-5 transition-transform duration-200 ${
            isTelemetryActive ? 'text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-slate-400'
          }`} 
        />
        <span 
          className={`text-[9px] font-mono-military tracking-wider mt-1 uppercase transition-colors ${
            isTelemetryActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          Soporte
        </span>
        {isTelemetryActive && (
          <span className="absolute bottom-0 w-4 h-0.5 bg-emerald-400 rounded-full" />
        )}
      </button>

      {/* Tab 3: Alerts */}
      <button
        id="btn-mobile-nav-alerts"
        onClick={() => handleTabClick('map', true)} // switches view to Map context under alerts modal overlay
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all cursor-pointer relative"
      >
        <div className="relative">
          <Bell 
            className={`w-5 h-5 transition-transform duration-200 ${
              isAlertsActive ? 'text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-slate-400'
            }`} 
          />
          {unreadAlertsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-slate-100 text-[8.5px] font-bold font-mono-military animate-pulse shadow-md">
              {unreadAlertsCount}
            </span>
          )}
        </div>
        <span 
          className={`text-[9px] font-mono-military tracking-wider mt-1 uppercase transition-colors ${
            isAlertsActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          Alertas
        </span>
        {isAlertsActive && (
          <span className="absolute bottom-0 w-4 h-0.5 bg-emerald-400 rounded-full" />
        )}
      </button>
    </div>
  );
};
