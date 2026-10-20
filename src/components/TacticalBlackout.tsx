import React, { useState, useEffect } from 'react';
import { Clock, Eye, Shield, Lock, Power, Sliders } from 'lucide-react';
import { tacticalAudio } from '../utils/audioAlerts';

interface TacticalBlackoutProps {
  onDisableBlackout: () => void;
}

type ColorTheme = 'emerald' | 'amber' | 'infrared';

export const TacticalBlackout: React.FC<TacticalBlackoutProps> = ({ onDisableBlackout }) => {
  const [time, setTime] = useState<Date>(new Date());
  const [isMilitaryFormat, setIsMilitaryFormat] = useState<boolean>(true);
  const [theme, setTheme] = useState<ColorTheme>('emerald');
  const [showZulu, setShowZulu] = useState<boolean>(false);
  const [centiseconds, setCentiseconds] = useState<string>('00');

  // Clock ticks
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now);
      
      // Calculate precise centiseconds (00-99)
      const ms = now.getMilliseconds();
      const cs = Math.floor(ms / 10).toString().padStart(2, '0');
      setCentiseconds(cs);
    };

    updateTime();
    const interval = setInterval(updateTime, 50); // fast refresh for milliseconds/centiseconds
    return () => clearInterval(interval);
  }, []);

  // Play a click sound on interaction
  const playClick = () => {
    try {
      tacticalAudio.playWarningBeep();
    } catch (e) {
      // Ignored
    }
  };

  const toggleFormat = () => {
    playClick();
    setIsMilitaryFormat(!isMilitaryFormat);
  };

  const toggleTimezone = () => {
    playClick();
    setShowZulu(!showZulu);
  };

  const rotateTheme = () => {
    playClick();
    const themes: ColorTheme[] = ['emerald', 'amber', 'infrared'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const handleDeactivate = () => {
    try {
      tacticalAudio.playRadioRoger();
    } catch (e) {}
    onDisableBlackout();
  };

  // Theme-specific styles
  const themeClasses = {
    emerald: {
      text: 'text-emerald-500',
      textMuted: 'text-emerald-800',
      border: 'border-emerald-500/30',
      borderFocus: 'border-emerald-500',
      bgGlow: 'shadow-emerald-950/20',
      bgHover: 'hover:bg-emerald-950/40',
      buttonBg: 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-500/40',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    },
    amber: {
      text: 'text-amber-500',
      textMuted: 'text-amber-800',
      border: 'border-amber-500/30',
      borderFocus: 'border-amber-500',
      bgGlow: 'shadow-amber-950/20',
      bgHover: 'hover:bg-amber-950/40',
      buttonBg: 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border-amber-500/40',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    },
    infrared: {
      text: 'text-red-500',
      textMuted: 'text-red-800',
      border: 'border-red-500/30',
      borderFocus: 'border-red-500',
      bgGlow: 'shadow-red-950/20',
      bgHover: 'hover:bg-red-950/40',
      buttonBg: 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border-red-500/40',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    },
  }[theme];

  // Formatting hours
  const formatHourString = () => {
    let t = new Date(time);
    if (showZulu) {
      // Get UTC hours
      const h = t.getUTCHours().toString().padStart(2, '0');
      const m = t.getUTCMinutes().toString().padStart(2, '0');
      const s = t.getUTCSeconds().toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    } else {
      // Local Time hours
      if (isMilitaryFormat) {
        const h = t.getHours().toString().padStart(2, '0');
        const m = t.getMinutes().toString().padStart(2, '0');
        const s = t.getSeconds().toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
      } else {
        let hours = t.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const h = hours.toString().padStart(2, '0');
        const m = t.getMinutes().toString().padStart(2, '0');
        const s = t.getSeconds().toString().padStart(2, '0');
        return `${h}:${m}:${s} ${ampm}`;
      }
    }
  };

  // Get date in military or local form
  const formatDateString = () => {
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const t = showZulu ? new Date(time.getTime() + time.getTimezoneOffset() * 60000) : time;
    const day = t.getDate().toString().padStart(2, '0');
    const month = months[t.getMonth()];
    const year = t.getFullYear();
    const zoneLabel = showZulu ? 'ZULU/UTC' : 'H_LOCAL';
    return `${day} ${month} ${year} [${zoneLabel}]`;
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-between p-6 sm:p-12 select-none overflow-hidden font-mono"
      style={{ backgroundImage: 'radial-gradient(circle, #020617 0%, #000000 100%)' }}
      id="blackout-screen"
    >
      {/* Decorative military grid scanning line effects */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_95%,rgba(255,255,255,1)_95%)] bg-[length:100%_4px] z-10" />

      {/* Top Banner Status Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between text-[10px] sm:text-xs text-slate-500 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-600" />
          <span className="tracking-widest font-black text-slate-400">PUESTO DE MANDO TÁCTICO MÓVIL</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme === 'emerald' ? 'bg-emerald-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${theme === 'emerald' ? 'bg-emerald-500' : theme === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
          </span>
          <span className="tracking-widest uppercase font-semibold">SIGILO ACTIVO</span>
        </div>
      </div>

      {/* Central Tactical Clock Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl">
        
        {/* Helper instructions */}
        <p className="text-[10px] text-slate-600 tracking-wider mb-6 text-center uppercase">
          Toca los controles inferiores o el panel para ajustar el formato del visor táctil.
        </p>

        {/* Large clock card */}
        <div 
          onClick={toggleFormat}
          className={`w-full bg-black/40 border ${themeClasses.border} rounded-2xl p-6 sm:p-12 flex flex-col items-center justify-center transition-all ${themeClasses.glow} ${themeClasses.bgHover} cursor-pointer group`}
          title="Toca para cambiar el formato de hora (12h/24h)"
          id="tactile-clock-panel"
        >
          {/* Bezel Title */}
          <div className="w-full flex justify-between text-[9px] font-bold text-slate-500 mb-6 font-mono-military tracking-widest border-b border-slate-900/50 pb-2">
            <span>AEGIS-BASE CLK</span>
            <span className={themeClasses.text}>{showZulu ? 'UTC/ZULU MODE' : 'LOCAL MIL-SPEC'}</span>
          </div>

          {/* Time display */}
          <div className="relative flex items-baseline justify-center">
            <span className={`text-4xl sm:text-7xl font-bold font-mono tracking-widest ${themeClasses.text} transition-colors duration-300`}>
              {formatHourString()}
            </span>
            <span className={`text-lg sm:text-2xl font-semibold ml-2 font-mono ${themeClasses.textMuted} transition-colors duration-300`}>
              .{centiseconds}
            </span>
          </div>

          {/* Date display */}
          <div className="mt-6 text-xs sm:text-sm font-semibold tracking-widest text-slate-400 font-mono-military uppercase flex items-center gap-2">
            <span>{formatDateString()}</span>
          </div>

          {/* Device status readouts */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[9px] text-slate-500 font-mono tracking-wider pt-6 border-t border-slate-900/50 w-full">
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <span className={`h-1.5 w-1.5 rounded-full ${theme === 'emerald' ? 'bg-emerald-500' : theme === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
              <span>EMISIÓN: 0.00% (MÁSCARA)</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <span className={`h-1.5 w-1.5 rounded-full ${theme === 'emerald' ? 'bg-emerald-500' : theme === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
              <span>GPS: CON ELIMINACIÓN</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center sm:justify-end col-span-2 sm:col-span-1">
              <span className={`h-1.5 w-1.5 rounded-full ${theme === 'emerald' ? 'bg-emerald-500' : theme === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
              <span>F_EXT: RESTRICCION TOTAL</span>
            </div>
          </div>
        </div>

        {/* Tactile Controls Selector Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 w-full">
          <button
            id="btn-clock-format"
            onClick={toggleFormat}
            className={`px-3 py-2 rounded-lg border text-[10px] font-bold uppercase font-mono-military transition-all flex items-center gap-1.5 ${themeClasses.buttonBg}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Formato: {isMilitaryFormat ? '24H' : '12H'}</span>
          </button>

          <button
            id="btn-clock-timezone"
            onClick={toggleTimezone}
            className={`px-3 py-2 rounded-lg border text-[10px] font-bold uppercase font-mono-military transition-all flex items-center gap-1.5 ${themeClasses.buttonBg}`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Zona: {showZulu ? 'Zulu (UTC)' : 'Local'}</span>
          </button>

          <button
            id="btn-clock-theme"
            onClick={rotateTheme}
            className={`px-3 py-2 rounded-lg border text-[10px] font-bold uppercase font-mono-military transition-all flex items-center gap-1.5 ${themeClasses.buttonBg}`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tema: {theme.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Safety Instructions & Reactivation Button */}
      <div className="w-full max-w-md flex flex-col items-center gap-4 border-t border-slate-900 pt-6">
        <p className="text-[9px] text-slate-600 text-center uppercase leading-relaxed max-w-xs">
          El terminal se encuentra en modo silenciado visual contra observación aérea e interferencia hostil. Pulsa el botón inferior para restablecer el enlace de datos.
        </p>

        <button
          id="btn-exit-blackout"
          onClick={handleDeactivate}
          className={`w-full py-3.5 rounded-xl border font-bold text-xs uppercase tracking-widest font-mono-military transition-all duration-350 shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
            theme === 'emerald'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-400 hover:shadow-emerald-950/20'
              : theme === 'amber'
              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-400 hover:shadow-amber-950/20'
              : 'bg-red-600 hover:bg-red-500 text-slate-950 border-red-400 hover:shadow-red-950/20'
          }`}
        >
          <Power className="w-4 h-4" />
          <span>Restablecer Canal C4I</span>
        </button>
      </div>
    </div>
  );
};
