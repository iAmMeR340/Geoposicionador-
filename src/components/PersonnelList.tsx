import React, { useState } from 'react';
import { Soldier, SoldierStatus, TacticalZone, TacticalAlert } from '../types';
import { 
  Users, 
  Search, 
  Heart, 
  Thermometer, 
  Wind, 
  Battery, 
  Shield, 
  AlertOctagon, 
  Radio, 
  Crosshair, 
  Flame, 
  Activity,
  UserPlus,
  Compass
} from 'lucide-react';
import { latLngToMGRS } from '../utils/cryptoUtils';
import { TacticalSuggestions } from './TacticalSuggestions';

interface PersonnelListProps {
  soldiers: Soldier[];
  zones: TacticalZone[];
  alerts: TacticalAlert[];
  selectedSoldierId: string | null;
  onSelectSoldier: (id: string) => void;
  onOpenTelemetryTab: (id: string) => void;
  onTriggerSoldierEmergency: (id: string) => void;
  onAddNewSoldier: () => void;
}

export const PersonnelList: React.FC<PersonnelListProps> = ({
  soldiers,
  zones,
  alerts,
  selectedSoldierId,
  onSelectSoldier,
  onOpenTelemetryTab,
  onTriggerSoldierEmergency,
  onAddNewSoldier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSquad, setSelectedSquad] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterRank, setFilterRank] = useState<'TODOS' | 'OFICIAL' | 'SUBOFICIAL' | 'TROPA'>('TODOS');

  const squads = [
    'TODAS',
    'Escuadra Alfa (Vanguardia)',
    'Escuadra Cóndor (Reconocimiento)',
    'Escuadra Centinela (Perímetro)',
    'Unidad MEDEVAC Táctica',
  ];

  const getRankCategory = (rank: string): 'OFICIAL' | 'SUBOFICIAL' | 'TROPA' => {
    const r = rank.toUpperCase();
    if (
      r.includes('CAPITÁN') ||
      r.includes('CAPITAN') ||
      r.includes('TENIENTE') ||
      r.includes('CORONEL') ||
      r.includes('MAYOR') ||
      r.includes('GENERAL')
    ) {
      return 'OFICIAL';
    }
    if (
      r.includes('SARGENTO') ||
      r.includes('CABO') ||
      r.includes('SUB-OFICIAL') ||
      r.includes('SUBOFICIAL')
    ) {
      return 'SUBOFICIAL';
    }
    return 'TROPA';
  };

  const filteredSoldiers = soldiers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.callsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSquad = selectedSquad === 'TODAS' || s.squad === selectedSquad;
    const matchesStatus =
      filterStatus === 'TODOS' ||
      (filterStatus === 'CRITICO' && (s.status === 'CRITICO' || s.status === 'SOS_EMERGENCIA')) ||
      (filterStatus === 'PATRULLA' && s.status === 'PATRULLAJE') ||
      (filterStatus === 'OPERATIVO' && s.status === 'OPERATIVO');
    const matchesRank =
      filterRank === 'TODOS' || getRankCategory(s.rank) === filterRank;

    return matchesSearch && matchesSquad && matchesStatus && matchesRank;
  });

  const getStatusBadge = (soldier: Soldier) => {
    if (soldier.currentZoneId === 'OUT_OF_BOUNDS') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-military bg-red-600 text-white border border-red-500 flex items-center gap-1 animate-pulse" title="Fuera del perímetro de geocercas">
          <AlertOctagon className="w-3.5 h-3.5" />
          FUERA DE LÍMITES
        </span>
      );
    }
    const status = soldier.status;
    switch (status) {
      case 'SOS_EMERGENCIA':
      case 'CRITICO':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-military bg-red-950 text-red-300 border border-red-500/60 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            EMERGENCIA SOS
          </span>
        );
      case 'EN_ALERTA':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-military bg-amber-950 text-amber-300 border border-amber-500/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            EN ALERTA
          </span>
        );
      case 'PATRULLAJE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-military bg-cyan-950 text-cyan-300 border border-cyan-500/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
            PATRULLA ACTIVA
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-military bg-emerald-950 text-emerald-300 border border-emerald-500/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            OPERATIVO NORMAL
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl flex flex-col h-full backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700/80">
        <div>
          <h2 className="font-tactical text-base font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-shadow-tactical">PERSONAL DESPLEGADO EN CAMPO</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono-military font-bold border border-slate-700">
              {filteredSoldiers.length} OPERADORES
            </span>
          </h2>
          <p className="text-xs text-slate-300">
            Telemetría biométrica continua y coordenadas satelitales encriptadas
          </p>
        </div>

        <button
          id="btn-add-soldier"
          onClick={onAddNewSoldier}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono-military font-bold transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Desplegar Nuevo Operador</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="space-y-2 mb-4 p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
        
        {/* Row 1: Search and Squad Select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="search-soldier-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por indicativo, nombre..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Squad Filter */}
          <select
            id="select-squad-filter"
            value={selectedSquad}
            onChange={(e) => setSelectedSquad(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors font-mono-military"
          >
            {squads.map((sq) => (
              <option key={sq} value={sq}>
                {sq === 'TODAS' ? 'TODAS LAS ESCUADRAS' : sq}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Rank Filter and Status Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          {/* Rank Selector */}
          <select
            id="select-rank-filter"
            value={filterRank}
            onChange={(e) => setFilterRank(e.target.value as any)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors font-mono-military"
          >
            <option value="TODOS">TODOS LOS RANGOS</option>
            <option value="OFICIAL">OFICIALES (CAP, TEN)</option>
            <option value="SUBOFICIAL">SUBOFICIALES (SGT, CABO)</option>
            <option value="TROPA">TROPA (SOLDADOS)</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-850">
            <button
              onClick={() => setFilterStatus('TODOS')}
              className={`flex-1 py-1 rounded text-[10px] font-mono-military uppercase tracking-wider transition-colors ${
                filterStatus === 'TODOS'
                  ? 'bg-slate-800 text-slate-100 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('PATRULLA')}
              className={`flex-1 py-1 rounded text-[10px] font-mono-military uppercase tracking-wider transition-colors ${
                filterStatus === 'PATRULLA'
                  ? 'bg-cyan-900/60 text-cyan-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Patrulla
            </button>
            <button
              onClick={() => setFilterStatus('CRITICO')}
              className={`flex-1 py-1 rounded text-[10px] font-mono-military uppercase tracking-wider transition-colors ${
                filterStatus === 'CRITICO'
                  ? 'bg-red-900/60 text-red-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Críticos
            </button>
          </div>
        </div>
      </div>

      {/* Tactical Rule-Based Recommendations Module */}
      <div className="mb-4">
        <TacticalSuggestions
          soldiers={soldiers}
          zones={zones}
          alerts={alerts}
          onSelectSoldier={onSelectSoldier}
        />
      </div>

      {/* Roster Cards List */}
      <div className="space-y-2.5 overflow-y-auto flex-1 min-h-[300px] max-h-[640px] pr-1">
        {filteredSoldiers.map((soldier) => {
          const isSelected = soldier.id === selectedSoldierId;
          const isCritical = soldier.status === 'SOS_EMERGENCIA' || soldier.status === 'CRITICO';

          return (
            <div
              key={soldier.id}
              id={`soldier-card-${soldier.id}`}
              onClick={() => onSelectSoldier(soldier.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-950/40'
                  : isCritical
                  ? 'bg-red-950/30 border-red-500/50 hover:border-red-400'
                  : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={soldier.avatar}
                      alt={soldier.name}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-700"
                    />
                    {soldier.isUserDevice && (
                      <span
                        className="absolute -bottom-1 -right-1 bg-cyan-500 text-slate-950 rounded-full p-0.5 text-[8px] font-bold"
                        title="Dispositivo del Usuario"
                      >
                        GPS
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-tactical font-bold text-sm text-slate-100">
                        {soldier.callsign}
                      </span>
                      <span className="text-[11px] font-mono-military text-slate-400">
                        {soldier.rank}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">{soldier.name}</p>
                    <p className="text-[10px] text-slate-400">{soldier.role} &bull; {soldier.squad}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(soldier)}
                  <span className="text-[10px] font-mono-military text-slate-400">
                    MGRS: {latLngToMGRS(soldier.location.lat, soldier.location.lng).split(' ').slice(1).join(' ')}
                  </span>
                </div>
              </div>

              {/* Vitals Ribbon */}
              <div className="grid grid-cols-4 gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-800/60 mb-2.5">
                {/* Heart Rate */}
                <div className="flex items-center gap-1.5">
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      soldier.vitals.heartRate > 130
                        ? 'text-red-400 animate-pulse'
                        : soldier.vitals.heartRate < 55
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  />
                  <div>
                    <p className="text-[9px] text-slate-400 leading-tight">PULSO</p>
                    <p className={`text-xs font-mono-military font-bold ${
                      soldier.vitals.heartRate > 130 ? 'text-red-400' : 'text-slate-200'
                    }`}>
                      {soldier.vitals.heartRate} <span className="text-[9px] font-normal text-slate-400">BPM</span>
                    </p>
                  </div>
                </div>

                {/* Temp */}
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <p className="text-[9px] text-slate-400 leading-tight">TEMP</p>
                    <p className={`text-xs font-mono-military font-bold ${
                      soldier.vitals.temperature > 38.2 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {soldier.vitals.temperature}°C
                    </p>
                  </div>
                </div>

                {/* SpO2 */}
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <div>
                    <p className="text-[9px] text-slate-400 leading-tight">SpO2</p>
                    <p className={`text-xs font-mono-military font-bold ${
                      soldier.vitals.oxygenSaturation < 92 ? 'text-red-400' : 'text-slate-200'
                    }`}>
                      {soldier.vitals.oxygenSaturation}%
                    </p>
                  </div>
                </div>

                {/* Battery & Stress */}
                <div className="flex items-center gap-1.5">
                  <Battery className={`w-3.5 h-3.5 ${
                    soldier.device.batteryLevel < 30 ? 'text-red-400' : 'text-emerald-400'
                  }`} />
                  <div>
                    <p className="text-[9px] text-slate-400 leading-tight">BAT/ESTRÉS</p>
                    <p className="text-xs font-mono-military text-slate-200 font-bold">
                      {soldier.device.batteryLevel}% <span className="text-[9px] font-normal text-slate-400">({soldier.vitals.stressLevel[0]})</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40">
                <div className="flex items-center gap-2 text-[10px] font-mono-military text-slate-400">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    {soldier.device.connectionType}
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-slate-300">Precisión &plusmn;{soldier.location.accuracy}m</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    id={`btn-telemetry-view-${soldier.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTelemetryTab(soldier.id);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-military flex items-center gap-1 transition-colors"
                  >
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>Telemetría</span>
                  </button>

                  <button
                    id={`btn-sos-trigger-${soldier.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerSoldierEmergency(soldier.id);
                    }}
                    className="px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 text-xs font-mono-military transition-colors"
                    title="Simular Alerta SOS para este operador"
                  >
                    <AlertOctagon className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
