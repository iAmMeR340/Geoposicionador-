import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Compass,
  Users,
  Clock,
  Navigation,
  AlertTriangle,
  Play,
  CheckCircle2,
  Pause,
  Layers,
  Sparkles,
  ChevronRight,
  Route,
  Target,
  Maximize2
} from 'lucide-react';
import { TacticalZone, TacticalPatrol, ZoneRiskLevel, PatrolStatus, Soldier } from '../types';

interface SecurityZoneConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  zones: TacticalZone[];
  onUpdateZones: (newZones: TacticalZone[]) => void;
  patrols: TacticalPatrol[];
  onUpdatePatrols: (newPatrols: TacticalPatrol[]) => void;
  soldiers: Soldier[];
  onSelectZoneOnMap?: (zoneId: string) => void;
}

export const SecurityZoneConfigurator: React.FC<SecurityZoneConfiguratorProps> = ({
  isOpen,
  onClose,
  zones,
  onUpdateZones,
  patrols,
  onUpdatePatrols,
  soldiers,
  onSelectZoneOnMap,
}) => {
  const [activeTab, setActiveTab] = useState<'ZONAS' | 'PATRULLAS'>('ZONAS');
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id || '');

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonsMapRef = useRef<Map<string, L.Polygon>>(new Map());
  const labelMarkerRef = useRef<L.Marker | null>(null);
  const dispersalCircleRef = useRef<L.Circle | null>(null);

  // New Zone Form State
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCode, setNewZoneCode] = useState('');
  const [newZoneRisk, setNewZoneRisk] = useState<ZoneRiskLevel>('VIGILANCIA_MEDIA');
  const [newZoneColor, setNewZoneColor] = useState('#3b82f6');
  const [newZoneDescription, setNewZoneDescription] = useState('');
  const [newZoneProtocol, setNewZoneProtocol] = useState('');
  const [newZoneLat, setNewZoneLat] = useState('9.40614');
  const [newZoneLng, setNewZoneLng] = useState('-75.68671');
  const [newZoneSize, setNewZoneSize] = useState<'PEQUEÑA' | 'MEDIANA' | 'GRANDE'>('MEDIANA');
  const [newZoneDispersalRadius, setNewZoneDispersalRadius] = useState<number>(100);

  // Edit Zone Temporary State
  const [editZoneData, setEditZoneData] = useState<Partial<TacticalZone>>({});

  // New Patrol Form State
  const [isCreatingPatrol, setIsCreatingPatrol] = useState(false);
  const [newPatrolName, setNewPatrolName] = useState('');
  const [newPatrolSquad, setNewPatrolSquad] = useState('Escuadra Alfa (Vanguardia)');
  const [newPatrolLeaderId, setNewPatrolLeaderId] = useState(soldiers[0]?.id || '');
  const [newPatrolZoneId, setNewPatrolZoneId] = useState(zones[0]?.id || '');
  const [newPatrolObjective, setNewPatrolObjective] = useState('');
  const [newPatrolStartTime, setNewPatrolStartTime] = useState('15:00');
  const [newPatrolEndTime, setNewPatrolEndTime] = useState('18:00');

  // Currently selected zone object
  const selectedZone = zones.find(z => z.id === selectedZoneId) || zones[0] || null;

  // Initialize and update Leaflet preview map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [9.40614, -75.68671],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear previous polygons
    polygonsMapRef.current.forEach((poly) => map.removeLayer(poly));
    polygonsMapRef.current.clear();

    if (labelMarkerRef.current) {
      map.removeLayer(labelMarkerRef.current);
      labelMarkerRef.current = null;
    }
    if (dispersalCircleRef.current) {
      map.removeLayer(dispersalCircleRef.current);
      dispersalCircleRef.current = null;
    }

    // Render all zone polygons
    zones.forEach((zone) => {
      const isSelected = zone.id === selectedZoneId;
      const poly = L.polygon(zone.coordinates, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: isSelected ? 0.45 : 0.2,
        weight: isSelected ? 3.5 : 2,
        dashArray: zone.riskLevel === 'ZONA_CRITICA_RESTRINGIDA' ? '6, 6' : undefined,
      }).addTo(map);

      poly.on('click', () => {
        setSelectedZoneId(zone.id);
      });

      polygonsMapRef.current.set(zone.id, poly);
    });

    // Render Floating Label & Dispersal Radius Circle for SELECTED zone
    if (selectedZone) {
      const center = selectedZone.center;
      const radius = selectedZone.dispersalRadiusMeters || 100;

      // Draw Dispersal Radius Buffer Circle
      const circle = L.circle(center, {
        radius: radius,
        color: '#38bdf8',
        fillColor: '#0284c7',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '4, 4',
      }).addTo(map);
      dispersalCircleRef.current = circle;

      // Floating Badge DivIcon
      const labelHtml = `
        <div class="px-3 py-2 bg-slate-950/95 border-2 border-emerald-400 rounded-xl shadow-2xl font-mono-military text-slate-100 flex flex-col gap-1 backdrop-blur-md whitespace-nowrap -translate-x-1/2 -translate-y-full transition-transform">
          <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <span class="font-bold text-emerald-400 text-[11px] uppercase">${selectedZone.code}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
              selectedZone.riskLevel === 'ZONA_CRITICA_RESTRINGIDA'
                ? 'bg-red-950 text-red-300 border border-red-800'
                : selectedZone.riskLevel === 'ALTO_RIESGO'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }">${selectedZone.riskLevel.replace(/_/g, ' ')}</span>
          </div>
          <p class="font-bold text-slate-100 text-xs">${selectedZone.name}</p>
          <div class="flex items-center justify-between gap-3 text-[10px] text-cyan-300 pt-0.5 font-mono">
            <span>📍 Radio Dispersión: <strong class="text-white">${radius}m</strong></span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: labelHtml,
        className: 'tactical-zone-floating-label',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker(center, { icon: customIcon, interactive: false }).addTo(map);
      labelMarkerRef.current = marker;

      // Pan camera smoothly to selected zone center
      map.panTo(center);
    }

  }, [isOpen, zones, selectedZoneId]);

  if (!isOpen) return null;

  // Generate rectangle coordinates around center
  const generateCoordinates = (centerLat: number, centerLng: number, size: 'PEQUEÑA' | 'MEDIANA' | 'GRANDE'): [number, number][] => {
    const delta = size === 'PEQUEÑA' ? 0.0015 : size === 'MEDIANA' ? 0.003 : 0.006;
    return [
      [centerLat + delta, centerLng - delta],
      [centerLat + delta, centerLng + delta],
      [centerLat - delta, centerLng + delta],
      [centerLat - delta, centerLng - delta],
    ];
  };

  const handleSaveNewZone = () => {
    if (!newZoneName.trim() || !newZoneCode.trim()) return;

    const lat = parseFloat(newZoneLat) || 9.4061;
    const lng = parseFloat(newZoneLng) || -75.6867;
    const coords = generateCoordinates(lat, lng, newZoneSize);

    const created: TacticalZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName,
      code: newZoneCode.toUpperCase(),
      riskLevel: newZoneRisk,
      category: newZoneRisk === 'ZONA_CRITICA_RESTRINGIDA' ? 'RIESGO' : newZoneRisk === 'ALTO_RIESGO' ? 'PATRULLA' : 'HQ',
      color: newZoneColor,
      fillOpacity: 0.22,
      center: [lat, lng],
      coordinates: coords,
      description: newZoneDescription || 'Sector geodelimitado de patrullaje táctico.',
      protocol: newZoneProtocol || 'Protocolo Estándar de Infantería de Marina.',
      dispersalRadiusMeters: newZoneDispersalRadius,
    };

    onUpdateZones([...zones, created]);
    setSelectedZoneId(created.id);
    setIsCreatingZone(false);
    resetNewZoneForm();
  };

  const resetNewZoneForm = () => {
    setNewZoneName('');
    setNewZoneCode('');
    setNewZoneRisk('VIGILANCIA_MEDIA');
    setNewZoneColor('#3b82f6');
    setNewZoneDescription('');
    setNewZoneProtocol('');
    setNewZoneLat('9.40614');
    setNewZoneLng('-75.68671');
    setNewZoneDispersalRadius(100);
  };

  const handleDeleteZone = (id: string) => {
    const remaining = zones.filter((z) => z.id !== id);
    onUpdateZones(remaining);
    if (selectedZoneId === id && remaining.length > 0) {
      setSelectedZoneId(remaining[0].id);
    }
  };

  const startEditZone = (zone: TacticalZone) => {
    setEditingZoneId(zone.id);
    setSelectedZoneId(zone.id);
    setEditZoneData({ ...zone });
  };

  const saveEditedZone = () => {
    if (!editingZoneId || !editZoneData.name) return;
    onUpdateZones(
      zones.map((z) => (z.id === editingZoneId ? ({ ...z, ...editZoneData } as TacticalZone) : z))
    );
    setEditingZoneId(null);
    setEditZoneData({});
  };

  // Handle Register New Patrol
  const handleSaveNewPatrol = () => {
    if (!newPatrolName.trim()) return;

    const selectedLeader = soldiers.find((s) => s.id === newPatrolLeaderId) || soldiers[0];
    const targetZone = zones.find((z) => z.id === newPatrolZoneId) || zones[0];

    const center = targetZone ? targetZone.center : [9.40614, -75.68671];
    const waypoints: [number, number][] = [
      [center[0] - 0.001, center[1] - 0.001],
      [center[0] + 0.001, center[1] - 0.001],
      [center[0] + 0.001, center[1] + 0.001],
      [center[0] - 0.001, center[1] + 0.001],
    ];

    const createdPatrol: TacticalPatrol = {
      id: `patrol-${Date.now()}`,
      code: `PAT-${selectedLeader?.callsign.split(' ')[0] || 'TAC'}-${Math.floor(Math.random() * 90 + 10)}`,
      name: newPatrolName,
      squad: newPatrolSquad,
      leaderId: selectedLeader?.id || 'soldier-1',
      leaderCallsign: selectedLeader?.callsign || 'ALFA-1',
      zoneId: targetZone?.id || 'zone-hq',
      zoneName: targetZone?.name || 'Sector General',
      objective: newPatrolObjective || 'Vigilancia y patrullaje de rutina en el sector asignado.',
      status: 'EN_CURSO',
      startTime: newPatrolStartTime,
      estimatedEndTime: newPatrolEndTime,
      assignedSoldierIds: [selectedLeader?.id || 'soldier-1'],
      routeWaypoints: waypoints,
      createdAt: new Date().toISOString(),
    };

    onUpdatePatrols([createdPatrol, ...patrols]);
    setIsCreatingPatrol(false);
    resetNewPatrolForm();
  };

  const resetNewPatrolForm = () => {
    setNewPatrolName('');
    setNewPatrolObjective('');
    setNewPatrolStartTime('15:00');
    setNewPatrolEndTime('18:00');
  };

  const handleUpdatePatrolStatus = (id: string, status: PatrolStatus) => {
    onUpdatePatrols(
      patrols.map((p) => (p.id === id ? { ...p, status } : p))
    );
  };

  const handleDeletePatrol = (id: string) => {
    onUpdatePatrols(patrols.filter((p) => p.id !== id));
  };

  const getRiskBadge = (risk: ZoneRiskLevel) => {
    switch (risk) {
      case 'SEGURO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">SEGURO</span>;
      case 'VIGILANCIA_MEDIA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">VIGILANCIA</span>;
      case 'ALTO_RIESGO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-amber-950 text-amber-300 border border-amber-500/40">ALTO RIESGO</span>;
      case 'ZONA_CRITICA_RESTRINGIDA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-red-950 text-red-300 border border-red-500/40 animate-pulse">CRÍTICA RESTRINGIDA</span>;
    }
  };

  const getPatrolStatusBadge = (status: PatrolStatus) => {
    switch (status) {
      case 'EN_CURSO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center gap-1"><Play className="w-2.5 h-2.5" /> EN CURSO</span>;
      case 'PROGRAMADA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> PROGRAMADA</span>;
      case 'COMPLETADA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> COMPLETADA</span>;
      case 'PAUSADA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono-military font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1"><Pause className="w-2.5 h-2.5" /> PAUSADA</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-tactical font-bold text-slate-100 uppercase tracking-wider text-shadow-tactical">
                Configurador de Zonas & Registro de Patrullajes
              </h2>
              <p className="text-xs font-mono-military text-slate-400">
                Ajuste de geofencing perimetral y radio de dispersión de patrullaje C4I
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('ZONAS')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-mono-military font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'ZONAS'
                ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 border-x border-slate-800 shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Zonas de Seguridad ({zones.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('PATRULLAS')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-mono-military font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'PATRULLAS'
                ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-500 border-x border-slate-800 shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Route className="w-4 h-4" />
            <span>Registro de Patrullajes ({patrols.length})</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-900/40">

          {/* TAB 1: ZONAS DE SEGURIDAD */}
          {activeTab === 'ZONAS' && (
            <div className="space-y-4">
              
              {/* TOP ACTION & MAP SPLIT VIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* INTERACTIVE LEAFLET PREVIEW MAP WITH FLOATING LABELS (5 cols) */}
                <div className="lg:col-span-5 bg-slate-950 rounded-xl border border-slate-800 p-2 flex flex-col h-[280px] lg:h-[360px] relative shadow-inner">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800/80 mb-2">
                    <span className="text-[11px] font-mono-military font-bold text-slate-300 uppercase flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      Vista Táctica de Polígonos & Etiquetas Flotantes
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      {selectedZone ? selectedZone.code : 'Selecciona Zona'}
                    </span>
                  </div>

                  <div ref={mapContainerRef} className="w-full h-full flex-1 rounded-lg overflow-hidden border border-slate-800/80" />
                  
                  <div className="mt-1.5 px-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Etiqueta flotante activa al seleccionar zona.</span>
                    <span className="text-emerald-400">Radio Dispersión C4I</span>
                  </div>
                </div>

                {/* ZONE LIST / FORM CONTAINER (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  
                  {/* Top Header Controls */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono-military text-slate-400">
                      Ajuste de parámetros perimetrales y radio de dispersión.
                    </p>
                    {!isCreatingZone && (
                      <button
                        onClick={() => setIsCreatingZone(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono-military font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Crear Nueva Zona</span>
                      </button>
                    )}
                  </div>

                  {/* FORM: CREATE NEW ZONE */}
                  {isCreatingZone && (
                    <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-4 space-y-3 shadow-xl animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-tactical font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          <span>Definir Nueva Zona de Seguridad</span>
                        </h3>
                        <button
                          onClick={() => setIsCreatingZone(false)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Nombre de la Zona / Sector</label>
                          <input
                            type="text"
                            placeholder="Ej: Sector FOXTROT: Polvorín Sur"
                            value={newZoneName}
                            onChange={(e) => setNewZoneName(e.target.value)}
                            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Código Táctico</label>
                          <input
                            type="text"
                            placeholder="Ej: SEC-FOXTROT-SUR"
                            value={newZoneCode}
                            onChange={(e) => setNewZoneCode(e.target.value)}
                            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military uppercase focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Nivel de Riesgo</label>
                          <select
                            value={newZoneRisk}
                            onChange={(e) => setNewZoneRisk(e.target.value as ZoneRiskLevel)}
                            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="SEGURO">SEGURO (Verde)</option>
                            <option value="VIGILANCIA_MEDIA">VIGILANCIA MEDIA (Azul/Cyan)</option>
                            <option value="ALTO_RIESGO">ALTO RIESGO (Naranja/Ámbar)</option>
                            <option value="ZONA_CRITICA_RESTRINGIDA">ZONA CRÍTICA RESTRINGIDA (Rojo)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Color de Capa</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={newZoneColor}
                              onChange={(e) => setNewZoneColor(e.target.value)}
                              className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-slate-900"
                            />
                            <span className="text-xs font-mono-military text-slate-300">{newZoneColor}</span>
                          </div>
                        </div>

                        {/* RADIO DE DISPERSIÓN PERMISIBLE INPUT FIELD */}
                        <div>
                          <label className="text-[10px] font-mono-military text-cyan-400 uppercase font-bold flex items-center gap-1">
                            <Target className="w-3 h-3 text-cyan-400 inline" />
                            Radio Dispersión (m)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="1000"
                            step="10"
                            value={newZoneDispersalRadius}
                            onChange={(e) => setNewZoneDispersalRadius(parseInt(e.target.value) || 100)}
                            className="w-full mt-1 bg-slate-900 border border-cyan-500/60 rounded-lg px-3 py-1.5 text-xs text-cyan-200 font-mono-military focus:border-cyan-400 focus:outline-none font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Dimensión Polígono</label>
                          <select
                            value={newZoneSize}
                            onChange={(e) => setNewZoneSize(e.target.value as any)}
                            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="PEQUEÑA">Pequeña (~300m x 300m)</option>
                            <option value="MEDIANA">Mediana (~600m x 600m)</option>
                            <option value="GRANDE">Grande (~1.2km x 1.2km)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Latitud Centro</label>
                          <input
                            type="text"
                            value={newZoneLat}
                            onChange={(e) => setNewZoneLat(e.target.value)}
                            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono-military text-slate-400 uppercase">Longitud Centro</label>
                          <input
                            type="text"
                            value={newZoneLng}
                            onChange={(e) => setNewZoneLng(e.target.value)}
                            className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono-military text-slate-400 uppercase">Descripción & Protocolo de Seguridad</label>
                        <textarea
                          rows={2}
                          placeholder="Protocolos de acceso, nivel de encriptación y patrullaje de apoyo..."
                          value={newZoneProtocol}
                          onChange={(e) => setNewZoneProtocol(e.target.value)}
                          className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-emerald-500 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => setIsCreatingZone(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono-military"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveNewZone}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono-military font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Check className="w-4 h-4" />
                          <span>Guardar Zona de Seguridad</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LIST OF REGISTERED ZONES */}
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {zones.map((zone) => {
                      const isEditing = editingZoneId === zone.id;
                      const isSelected = selectedZoneId === zone.id;

                      return (
                        <div
                          key={zone.id}
                          onClick={() => setSelectedZoneId(zone.id)}
                          className={`border rounded-xl p-3 space-y-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-950 border-emerald-500 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editZoneData.name || ''}
                                onChange={(e) => setEditZoneData({ ...editZoneData, name: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono-military"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={editZoneData.riskLevel || zone.riskLevel}
                                  onChange={(e) => setEditZoneData({ ...editZoneData, riskLevel: e.target.value as any })}
                                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono-military"
                                >
                                  <option value="SEGURO">SEGURO</option>
                                  <option value="VIGILANCIA_MEDIA">VIGILANCIA_MEDIA</option>
                                  <option value="ALTO_RIESGO">ALTO_RIESGO</option>
                                  <option value="ZONA_CRITICA_RESTRINGIDA">ZONA_CRITICA_RESTRINGIDA</option>
                                </select>

                                {/* EDIT DISPERSAL RADIUS FIELD */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-cyan-400 font-mono">Radio:</span>
                                  <input
                                    type="number"
                                    value={editZoneData.dispersalRadiusMeters || zone.dispersalRadiusMeters || 100}
                                    onChange={(e) => setEditZoneData({ ...editZoneData, dispersalRadiusMeters: parseInt(e.target.value) || 100 })}
                                    className="w-full bg-slate-900 border border-cyan-500/60 rounded px-2 py-1 text-xs font-mono-military text-cyan-300 font-bold"
                                  />
                                  <span className="text-[10px] text-slate-400">m</span>
                                </div>
                              </div>

                              <textarea
                                rows={2}
                                value={editZoneData.protocol || ''}
                                onChange={(e) => setEditZoneData({ ...editZoneData, protocol: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono-military resize-none"
                              />
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  onClick={() => setEditingZoneId(null)}
                                  className="px-2 py-1 bg-slate-800 text-xs font-mono-military rounded"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={saveEditedZone}
                                  className="px-3 py-1 bg-emerald-600 text-slate-950 font-mono-military font-bold text-xs rounded"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                      style={{ backgroundColor: zone.color }}
                                    />
                                    <div>
                                      <h4 className="text-xs font-tactical font-bold text-slate-200 uppercase flex items-center gap-2">
                                        {zone.name}
                                        {isSelected && (
                                          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                                            ETIQUETA EN MAPA
                                          </span>
                                        )}
                                      </h4>
                                      <span className="text-[10px] font-mono-military text-slate-400">
                                        CÓDIGO: {zone.code}
                                      </span>
                                    </div>
                                  </div>
                                  {getRiskBadge(zone.riskLevel)}
                                </div>

                                <p className="text-[11px] font-mono-military text-slate-300 mt-1.5 line-clamp-2">
                                  {zone.description}
                                </p>
                              </div>

                              {/* DISPERSAL RADIUS BADGE IN CARD */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] font-mono-military">
                                <div className="flex items-center gap-2 text-slate-400">
                                  <span className="flex items-center gap-1 text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                                    <Target className="w-3 h-3 text-cyan-400" />
                                    Radio Dispersión: {zone.dispersalRadiusMeters || 100}m
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  {onSelectZoneOnMap && (
                                    <button
                                      onClick={() => onSelectZoneOnMap(zone.id)}
                                      className="p-1 hover:bg-slate-800 text-cyan-400 rounded transition-colors"
                                      title="Ver en el Mapa Táctico Principal"
                                    >
                                      <Navigation className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => startEditZone(zone)}
                                    className="p-1 hover:bg-slate-800 text-slate-300 rounded transition-colors"
                                    title="Editar Zona"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteZone(zone.id)}
                                    className="p-1 hover:bg-red-950 text-red-400 rounded transition-colors"
                                    title="Eliminar Zona"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: REGISTRO DE PATRULLAJES */}
          {activeTab === 'PATRULLAS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono-military text-slate-400">
                  Gestión y registro táctico de patrullajes, rutas y asignación de escuadras.
                </p>
                {!isCreatingPatrol && (
                  <button
                    onClick={() => setIsCreatingPatrol(true)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono-military font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-950 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Nuevo Patrullaje</span>
                  </button>
                )}
              </div>

              {/* Form Create New Patrol */}
              {isCreatingPatrol && (
                <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-4 space-y-3.5 shadow-xl animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-tactical font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Route className="w-4 h-4" />
                      <span>Registrar Nuevo Recorrido de Patrullaje</span>
                    </h3>
                    <button
                      onClick={() => setIsCreatingPatrol(false)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono-military text-slate-400 uppercase">Nombre / Misión de Patrullaje</label>
                      <input
                        type="text"
                        placeholder="Ej: Reconocimiento Sector Playa Norte"
                        value={newPatrolName}
                        onChange={(e) => setNewPatrolName(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono-military text-slate-400 uppercase">Escuadra Asignada</label>
                      <select
                        value={newPatrolSquad}
                        onChange={(e) => setNewPatrolSquad(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="Escuadra Alfa (Vanguardia)">Escuadra Alfa (Vanguardia)</option>
                        <option value="Escuadra Cóndor (Reconocimiento)">Escuadra Cóndor (Reconocimiento)</option>
                        <option value="Escuadra Centinela (Perímetro)">Escuadra Centinela (Perímetro)</option>
                        <option value="Unidad MEDEVAC Táctica">Unidad MEDEVAC Táctica</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono-military text-slate-400 uppercase">Líder de Patrulla / Operador</label>
                      <select
                        value={newPatrolLeaderId}
                        onChange={(e) => setNewPatrolLeaderId(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none"
                      >
                        {soldiers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.callsign} - {s.name} ({s.rank})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono-military text-slate-400 uppercase">Zona de Seguridad Asignada</label>
                      <select
                        value={newPatrolZoneId}
                        onChange={(e) => setNewPatrolZoneId(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none"
                      >
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} ({z.code}) - Radio Dispersión: {z.dispersalRadiusMeters || 100}m
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono-military text-slate-400 uppercase">Hora de Inicio</label>
                      <input
                        type="time"
                        value={newPatrolStartTime}
                        onChange={(e) => setNewPatrolStartTime(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono-military text-slate-400 uppercase">Hora Estimada de Término</label>
                      <input
                        type="time"
                        value={newPatrolEndTime}
                        onChange={(e) => setNewPatrolEndTime(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono-military text-slate-400 uppercase">Objetivo Operacional de la Misión</label>
                    <textarea
                      rows={2}
                      placeholder="Describa el objetivo estratégico, puntos de control e instrucciones específicas..."
                      value={newPatrolObjective}
                      onChange={(e) => setNewPatrolObjective(e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono-military focus:border-cyan-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setIsCreatingPatrol(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono-military"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveNewPatrol}
                      className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono-military font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>Registrar Patrullaje</span>
                    </button>
                  </div>
                </div>
              )}

              {/* List of Registered Patrols */}
              <div className="space-y-3">
                {patrols.map((patrol) => (
                  <div
                    key={patrol.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-military text-[10px] font-bold border border-slate-700">
                          {patrol.code}
                        </span>
                        <h4 className="text-xs font-tactical font-bold text-slate-100 uppercase">
                          {patrol.name}
                        </h4>
                        {getPatrolStatusBadge(patrol.status)}
                      </div>

                      <p className="text-[11px] font-mono-military text-slate-300">
                        {patrol.objective}
                      </p>

                      <div className="flex items-center gap-4 text-[10px] font-mono-military text-slate-400 pt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-cyan-400" />
                          <span>Líder: <strong className="text-slate-200">{patrol.leaderCallsign}</strong> ({patrol.squad})</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>Horario: {patrol.startTime} - {patrol.estimatedEndTime}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3 text-amber-400" />
                          <span>Zona: {patrol.zoneName}</span>
                        </span>
                      </div>
                    </div>

                    {/* Status Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {patrol.status === 'PROGRAMADA' && (
                        <button
                          onClick={() => handleUpdatePatrolStatus(patrol.id, 'EN_CURSO')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[10.5px] font-mono-military font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Iniciar</span>
                        </button>
                      )}
                      {patrol.status === 'EN_CURSO' && (
                        <>
                          <button
                            onClick={() => handleUpdatePatrolStatus(patrol.id, 'PAUSADA')}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10.5px] font-mono-military font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Pause className="w-3 h-3" />
                            <span>Pausar</span>
                          </button>
                          <button
                            onClick={() => handleUpdatePatrolStatus(patrol.id, 'COMPLETADA')}
                            className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-[10.5px] font-mono-military font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completar</span>
                          </button>
                        </>
                      )}
                      {patrol.status === 'PAUSADA' && (
                        <button
                          onClick={() => handleUpdatePatrolStatus(patrol.id, 'EN_CURSO')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[10.5px] font-mono-military font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Reanudar</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePatrol(patrol.id)}
                        className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar registro de patrullaje"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono-military text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Sincronización en tiempo real con Puesto de Mando C4I activa</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
