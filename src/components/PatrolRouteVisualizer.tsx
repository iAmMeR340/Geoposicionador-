import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Route,
  MapPin,
  Move,
  Plus,
  Trash2,
  Navigation,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Info,
  Shield,
  Compass,
  Maximize2,
  RefreshCw,
  Users,
  CheckCircle2,
  Sliders,
  Layers
} from 'lucide-react';
import { TacticalPatrol, Soldier } from '../types';
import { latLngToMGRS } from '../utils/cryptoUtils';
import { tacticalAudio } from '../utils/audioAlerts';

interface PatrolRouteVisualizerProps {
  map: L.Map | null;
  patrols: TacticalPatrol[];
  onUpdatePatrols?: (updatedPatrols: TacticalPatrol[]) => void;
  selectedPatrolId?: string | null;
  onSelectPatrolId?: (patrolId: string | null) => void;
  isVisible?: boolean;
  onToggleVisible?: () => void;
  soldiers?: Soldier[];
}

// Calculate distance in meters between two lat/lng points (Haversine)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Calculate bearing degrees from point 1 to point 2
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

// Midpoint between two coordinates
function getMidpoint(lat1: number, lon1: number, lat2: number, lon2: number): [number, number] {
  return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
}

// Tactical route colors
const PATROL_COLORS = ['#38bdf8', '#f59e0b', '#a855f7', '#10b981', '#ec4899', '#f97316'];

export const PatrolRouteVisualizer: React.FC<PatrolRouteVisualizerProps> = ({
  map,
  patrols,
  onUpdatePatrols,
  selectedPatrolId: externalSelectedPatrolId,
  onSelectPatrolId: externalOnSelectPatrolId,
  isVisible = true,
  onToggleVisible,
  soldiers = [],
}) => {
  // Local state
  const [selectedPatrolId, setSelectedPatrolId] = useState<string | null>(
    externalSelectedPatrolId || (patrols[0]?.id ?? null)
  );
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'control' | 'waypoints' | 'personnel'>('control');
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(true);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // References for Leaflet layers
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const markersRef = useRef<Map<string, L.Marker[]>>(new Map());
  const arrowsRef = useRef<Map<string, L.Marker[]>>(new Map());

  // Sync external patrol ID
  useEffect(() => {
    if (externalSelectedPatrolId !== undefined && externalSelectedPatrolId !== selectedPatrolId) {
      setSelectedPatrolId(externalSelectedPatrolId);
    }
  }, [externalSelectedPatrolId]);

  const handleSelectPatrol = (id: string | null) => {
    setSelectedPatrolId(id);
    if (externalOnSelectPatrolId) {
      externalOnSelectPatrolId(id);
    }
  };

  const activePatrol = useMemo(() => {
    return patrols.find((p) => p.id === selectedPatrolId) || patrols[0] || null;
  }, [patrols, selectedPatrolId]);

  // Route statistics (distance, walk duration, pace)
  const routeStats = useMemo(() => {
    if (!activePatrol || activePatrol.routeWaypoints.length < 2) {
      return { totalMeters: 0, totalKm: '0.00', durationNormalMin: 0, durationFastMin: 0, legs: [] };
    }
    let meters = 0;
    const legs: number[] = [];
    for (let i = 0; i < activePatrol.routeWaypoints.length - 1; i++) {
      const p1 = activePatrol.routeWaypoints[i];
      const p2 = activePatrol.routeWaypoints[i + 1];
      const legDist = calculateDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
      meters += legDist;
      legs.push(legDist);
    }
    const totalKm = (meters / 1000).toFixed(2);
    // Normal tactical walk pace: 3.5 km/h
    const durationNormalMin = Math.round((meters / 1000 / 3.5) * 60);
    // Fast tactical march: 5.5 km/h
    const durationFastMin = Math.round((meters / 1000 / 5.5) * 60);
    return { totalMeters: meters, totalKm, durationNormalMin, durationFastMin, legs };
  }, [activePatrol]);

  // Center map on selected route
  const handleFitRouteBounds = () => {
    if (!map || !activePatrol || activePatrol.routeWaypoints.length === 0) return;
    const bounds = L.latLngBounds(activePatrol.routeWaypoints);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true, duration: 1.0 });
    tacticalAudio.playRadioRoger();
    setLastNotification(`🗺️ Encuadrando ruta ${activePatrol.code} en el mapa`);
    setTimeout(() => setLastNotification(null), 3000);
  };

  // Render Leaflet Polylines, Markers, and Directional Arrows
  useEffect(() => {
    if (!map) return;

    // Clear previous layers
    polylinesRef.current.forEach((line) => map.removeLayer(line));
    polylinesRef.current.clear();

    markersRef.current.forEach((markerList) => markerList.forEach((m) => map.removeLayer(m)));
    markersRef.current.clear();

    arrowsRef.current.forEach((arrowList) => arrowList.forEach((a) => map.removeLayer(a)));
    arrowsRef.current.clear();

    if (!isVisible) return;

    patrols.forEach((patrol, patrolIndex) => {
      const isSelected = patrol.id === selectedPatrolId;
      const routeColor = PATROL_COLORS[patrolIndex % PATROL_COLORS.length];
      const waypoints = patrol.routeWaypoints;

      if (!waypoints || waypoints.length === 0) return;

      // 1. Draw Polyline Route
      const line = L.polyline(waypoints, {
        color: isSelected ? routeColor : '#64748b',
        weight: isSelected ? 4 : 2.5,
        opacity: isSelected ? 0.95 : 0.45,
        dashArray: patrol.status === 'PROGRAMADA' ? '8, 8' : undefined,
      }).addTo(map);

      line.bindTooltip(
        `<div class="p-1 font-mono-military text-xs">
          <p class="font-bold text-cyan-300">🗺️ ${patrol.code}</p>
          <p class="text-slate-200">${patrol.name}</p>
          <p class="text-[10px] text-amber-300">Waypoints: ${waypoints.length} | Estado: ${patrol.status}</p>
        </div>`,
        { sticky: true, className: 'leaflet-tactical-tooltip' }
      );

      polylinesRef.current.set(patrol.id, line);

      // 2. Draw Directional Flow Arrows on each leg
      const arrowMarkers: L.Marker[] = [];
      if (isSelected && waypoints.length >= 2) {
        for (let i = 0; i < waypoints.length - 1; i++) {
          const p1 = waypoints[i];
          const p2 = waypoints[i + 1];
          const mid = getMidpoint(p1[0], p1[1], p2[0], p2[1]);
          const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

          const arrowIcon = L.divIcon({
            className: 'route-direction-arrow-icon',
            html: `
              <div style="transform: rotate(${bearing}deg); width: 14px; height: 14px; display: flex; items-center; justify-content: center; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${routeColor}" stroke="#0f172a" stroke-width="1.5">
                  <polygon points="12 2, 22 22, 12 17, 2 22 12 2" />
                </svg>
              </div>
            `,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const arrowMarker = L.marker(mid, {
            icon: arrowIcon,
            interactive: false,
            zIndexOffset: 300 + i,
          }).addTo(map);

          arrowMarkers.push(arrowMarker);
        }
        arrowsRef.current.set(patrol.id, arrowMarkers);
      }

      // 3. Draw Waypoint Markers
      const patrolMarkers: L.Marker[] = [];

      waypoints.forEach((wp, wpIndex) => {
        const isStart = wpIndex === 0;
        const isEnd = wpIndex === waypoints.length - 1 && waypoints.length > 1;
        const isDragAllowed = isVisible && isEditMode && isSelected;

        // Custom DivIcon for Waypoint
        const icon = L.divIcon({
          className: 'custom-waypoint-marker',
          html: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] font-mono-military transition-transform shadow-lg ${
                isStart
                  ? 'bg-emerald-950 border-2 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30'
                  : isEnd
                  ? 'bg-rose-950 border-2 border-rose-400 text-rose-300 ring-2 ring-rose-500/30'
                  : isSelected
                  ? isEditMode
                    ? 'bg-amber-950 border-2 border-amber-400 text-amber-300 ring-2 ring-amber-500/50 scale-110'
                    : 'bg-slate-900 border-2 border-cyan-400 text-cyan-300 ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/90 border border-slate-600 text-slate-400'
              }">
                ${isStart ? '🚩' : isEnd ? '🎯' : wpIndex + 1}
              </div>
              ${
                isDragAllowed
                  ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></div>`
                  : ''
              }
              <div class="absolute top-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-slate-950 border border-slate-700 text-[10px] text-cyan-300 px-2 py-1 rounded shadow-xl font-mono-military z-50">
                ${isStart ? '🚩 INICIO' : isEnd ? '🎯 FIN' : `WP-${wpIndex + 1}`} (${wp[0].toFixed(4)}, ${wp[1].toFixed(4)})
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker(wp, {
          icon,
          draggable: isDragAllowed,
          zIndexOffset: isSelected ? 1000 + wpIndex : 500 + wpIndex,
        }).addTo(map);

        // Tooltip
        marker.bindTooltip(
          `<div class="p-1.5 font-mono-military text-[11px] space-y-0.5">
            <p class="font-bold text-cyan-300 flex items-center gap-1">
              ${isStart ? '🚩 PUNTO DE INICIO' : isEnd ? '🎯 PUNTO DE CIERRE' : `PUNTO DE CONTROL WP-${wpIndex + 1}`}
            </p>
            <p class="text-slate-300 font-semibold">${patrol.code} - ${patrol.name}</p>
            <p class="text-[10px] text-slate-400">Coords: ${wp[0].toFixed(5)}, ${wp[1].toFixed(5)}</p>
            <p class="text-[10px] text-emerald-400 font-bold">MGRS: ${latLngToMGRS(wp[0], wp[1])}</p>
            ${isDragAllowed ? '<p class="text-[10px] text-amber-300 font-bold mt-1 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-500/40">🖐️ Arrastre para reubicar sobre el terreno</p>' : ''}
          </div>`,
          { direction: 'top', className: 'leaflet-tactical-tooltip' }
        );

        // Real-time drag events
        if (isDragAllowed) {
          marker.on('drag', (e: L.LeafletEvent) => {
            const dragMarker = e.target as L.Marker;
            const newPos = dragMarker.getLatLng();

            // Real-time polyline update
            const updatedWaypoints = [...waypoints];
            updatedWaypoints[wpIndex] = [newPos.lat, newPos.lng];
            line.setLatLngs(updatedWaypoints);
          });

          marker.on('dragend', (e: L.LeafletEvent) => {
            const dragMarker = e.target as L.Marker;
            const newPos = dragMarker.getLatLng();

            const updatedWaypoints: [number, number][] = waypoints.map((pt, idx) =>
              idx === wpIndex ? [newPos.lat, newPos.lng] : pt
            );

            const updatedPatrols = patrols.map((p) =>
              p.id === patrol.id ? { ...p, routeWaypoints: updatedWaypoints } : p
            );

            if (onUpdatePatrols) {
              onUpdatePatrols(updatedPatrols);
            }

            tacticalAudio.playRadioRoger();
            const msg = `📍 WP-${wpIndex + 1} de ${patrol.code} actualizado (${newPos.lat.toFixed(4)}, ${newPos.lng.toFixed(4)})`;
            setLastNotification(msg);
            setTimeout(() => setLastNotification(null), 3500);
          });
        }

        patrolMarkers.push(marker);
      });

      markersRef.current.set(patrol.id, patrolMarkers);
    });
  }, [map, patrols, selectedPatrolId, isVisible, isEditMode, onUpdatePatrols]);

  // Click on map to add waypoint
  useEffect(() => {
    if (!map || !isAddingWaypoint || !activePatrol || !onUpdatePatrols) return;

    // Change map cursor
    const container = map.getContainer();
    const prevCursor = container.style.cursor;
    container.style.cursor = 'crosshair';

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const newWaypoints: [number, number][] = [...activePatrol.routeWaypoints, [lat, lng]];

      const updatedPatrols = patrols.map((p) =>
        p.id === activePatrol.id ? { ...p, routeWaypoints: newWaypoints } : p
      );

      onUpdatePatrols(updatedPatrols);
      tacticalAudio.playRadioRoger();
      setIsAddingWaypoint(false);

      const msg = `➕ Nuevo WP-${newWaypoints.length} fijado en ${activePatrol.code} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setLastNotification(msg);
      setTimeout(() => setLastNotification(null), 4000);
    };

    map.on('click', handleMapClick);
    return () => {
      container.style.cursor = prevCursor;
      map.off('click', handleMapClick);
    };
  }, [map, isAddingWaypoint, activePatrol, patrols, onUpdatePatrols]);

  // Waypoint operations
  const handleRemoveWaypoint = (indexToRemove: number) => {
    if (!activePatrol || !onUpdatePatrols) return;
    if (activePatrol.routeWaypoints.length <= 2) {
      alert('Una ruta táctica debe mantener al menos 2 waypoints.');
      return;
    }

    const updatedWaypoints = activePatrol.routeWaypoints.filter((_, idx) => idx !== indexToRemove);
    const updatedPatrols = patrols.map((p) =>
      p.id === activePatrol.id ? { ...p, routeWaypoints: updatedWaypoints } : p
    );

    onUpdatePatrols(updatedPatrols);
    tacticalAudio.playWarningBeep();
    setLastNotification(`🗑️ WP-${indexToRemove + 1} eliminado de ${activePatrol.code}`);
    setTimeout(() => setLastNotification(null), 3000);
  };

  const handleMoveWaypoint = (index: number, direction: 'UP' | 'DOWN') => {
    if (!activePatrol || !onUpdatePatrols) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activePatrol.routeWaypoints.length) return;

    const updatedWaypoints = [...activePatrol.routeWaypoints];
    const temp = updatedWaypoints[index];
    updatedWaypoints[index] = updatedWaypoints[targetIndex];
    updatedWaypoints[targetIndex] = temp;

    const updatedPatrols = patrols.map((p) =>
      p.id === activePatrol.id ? { ...p, routeWaypoints: updatedWaypoints } : p
    );

    onUpdatePatrols(updatedPatrols);
  };

  const handleReverseRoute = () => {
    if (!activePatrol || !onUpdatePatrols) return;
    const reversedWaypoints = [...activePatrol.routeWaypoints].reverse();
    const updatedPatrols = patrols.map((p) =>
      p.id === activePatrol.id ? { ...p, routeWaypoints: reversedWaypoints } : p
    );
    onUpdatePatrols(updatedPatrols);
    tacticalAudio.playRadioRoger();
    setLastNotification(`🔄 Ruta ${activePatrol.code} invertida`);
    setTimeout(() => setLastNotification(null), 3000);
  };

  // Close Loop (Circuit)
  const handleCloseCircuit = () => {
    if (!activePatrol || !onUpdatePatrols || activePatrol.routeWaypoints.length < 3) return;
    const firstPoint = activePatrol.routeWaypoints[0];
    const lastPoint = activePatrol.routeWaypoints[activePatrol.routeWaypoints.length - 1];

    // Check if already closed
    const isAlreadyClosed =
      Math.abs(firstPoint[0] - lastPoint[0]) < 0.00005 &&
      Math.abs(firstPoint[1] - lastPoint[1]) < 0.00005;

    if (isAlreadyClosed) {
      setLastNotification(`ℹ️ La ruta ${activePatrol.code} ya conforma un circuito cerrado.`);
      setTimeout(() => setLastNotification(null), 3000);
      return;
    }

    const updatedWaypoints: [number, number][] = [...activePatrol.routeWaypoints, [firstPoint[0], firstPoint[1]]];
    const updatedPatrols = patrols.map((p) =>
      p.id === activePatrol.id ? { ...p, routeWaypoints: updatedWaypoints } : p
    );

    onUpdatePatrols(updatedPatrols);
    tacticalAudio.playRadioRoger();
    setLastNotification(`⭕ Circuito de patrullaje cerrado para ${activePatrol.code}`);
    setTimeout(() => setLastNotification(null), 3000);
  };

  // Assigned personnel
  const assignedSoldiers = useMemo(() => {
    if (!activePatrol) return [];
    return soldiers.filter((s) => activePatrol.assignedSoldierIds.includes(s.id));
  }, [activePatrol, soldiers]);

  return (
    <div className="relative font-mono-military text-slate-100">
      {/* Tactical Toast Notification */}
      {lastNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95 border border-cyan-500/80 px-4 py-2 rounded-xl shadow-2xl shadow-cyan-500/30 text-xs font-bold text-cyan-300 flex items-center gap-2 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{lastNotification}</span>
        </div>
      )}

      {/* Main Tactical Route HUD Panel */}
      <div className="bg-slate-900/95 border border-slate-750 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden w-full">
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-950/80 border border-amber-500/50 rounded-lg text-amber-400">
              <Route className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                Rutas de Patrullaje
                <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-700/60 px-1.5 py-0.2 rounded font-extrabold">
                  {patrols.length}
                </span>
              </h4>
              <p className="text-[10px] text-slate-400">Editor Drag-and-Drop & Waypoints</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Center Route on Map */}
            {activePatrol && (
              <button
                onClick={handleFitRouteBounds}
                title="Centrar ruta completa en el mapa"
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400 hover:text-white hover:border-cyan-500 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Toggle Visibility */}
            {onToggleVisible && (
              <button
                onClick={onToggleVisible}
                title={isVisible ? 'Ocultar Rutas en Mapa' : 'Mostrar Rutas en Mapa'}
                className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                  isVisible
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 hover:bg-amber-900/60'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Expand / Collapse */}
            <button
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors"
            >
              {isPanelExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Body */}
        {isVisible && isPanelExpanded && (
          <div className="p-3 space-y-3">
            {/* Patrol Selector Dropdown */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                Patrulla Táctica Activa:
              </label>
              <select
                value={selectedPatrolId || ''}
                onChange={(e) => handleSelectPatrol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 text-xs text-amber-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-bold"
              >
                {patrols.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Metrics Banner */}
            {activePatrol && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200 font-bold truncate max-w-[200px]">{activePatrol.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                      activePatrol.status === 'EN_CURSO'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : activePatrol.status === 'PROGRAMADA'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {activePatrol.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-1 border-t border-slate-800/80">
                  <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[8.5px]">Distancia</span>
                    <span className="text-amber-300 font-bold">{routeStats.totalKm} km</span>
                  </div>
                  <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[8.5px]">Waypoints</span>
                    <span className="text-cyan-300 font-bold">{activePatrol.routeWaypoints.length}</span>
                  </div>
                  <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[8.5px]">Marcha</span>
                    <span className="text-emerald-300 font-bold">~{routeStats.durationNormalMin}m</span>
                  </div>
                  <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[8.5px]">Trote Táctico</span>
                    <span className="text-purple-300 font-bold">~{routeStats.durationFastMin}m</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 text-[10px] font-bold">
              <button
                onClick={() => setActiveTab('control')}
                className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
                  activeTab === 'control'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚙️ Control en Terreno
              </button>
              <button
                onClick={() => setActiveTab('waypoints')}
                className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
                  activeTab === 'waypoints'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📍 Waypoints ({activePatrol?.routeWaypoints.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('personnel')}
                className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
                  activeTab === 'personnel'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                👥 Personal ({assignedSoldiers.length})
              </button>
            </div>

            {/* TAB 1: Control & Drag-and-Drop */}
            {activeTab === 'control' && (
              <div className="space-y-2.5">
                {/* Drag and Drop Mode Toggle Button */}
                <button
                  id="patrol-toggle-drag-mode"
                  onClick={() => {
                    setIsEditMode(!isEditMode);
                    setIsAddingWaypoint(false);
                  }}
                  className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isEditMode
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/30 ring-2 ring-amber-400'
                      : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-750 hover:border-amber-500'
                  }`}
                >
                  <Move className={`w-3.5 h-3.5 ${isEditMode ? 'animate-bounce text-slate-950' : 'text-amber-400'}`} />
                  <span>
                    {isEditMode ? 'Edición Drag-and-Drop ACTIVA' : 'Habilitar Edición Drag-and-Drop'}
                  </span>
                </button>

                {isEditMode && (
                  <div className="p-2 bg-amber-950/50 border border-amber-500/40 rounded-lg text-[10px] text-amber-200 flex items-start gap-1.5 animate-pulse">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p>
                      <strong>Modo Terreno Activo:</strong> Arrastre los círculos numerados sobre el mapa para reubicar waypoints. La línea y distancias se recalculan en tiempo real.
                    </p>
                  </div>
                )}

                {/* Tactical Tools Grid */}
                {activePatrol && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {/* Add Waypoint Button */}
                    <button
                      onClick={() => setIsAddingWaypoint(!isAddingWaypoint)}
                      className={`py-1.5 px-2 rounded-lg border text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isAddingWaypoint
                          ? 'bg-cyan-950 border-cyan-400 text-cyan-300 animate-pulse'
                          : 'bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-750'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingWaypoint ? 'Clic en mapa...' : '+ Añadir Punto'}</span>
                    </button>

                    {/* Fit Route Bounds Button */}
                    <button
                      onClick={handleFitRouteBounds}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Encuadrar Ruta</span>
                    </button>

                    {/* Reverse Route */}
                    <button
                      onClick={handleReverseRoute}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Invertir Sentido</span>
                    </button>

                    {/* Close Circuit / Loop */}
                    <button
                      onClick={handleCloseCircuit}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cerrar Circuito</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Waypoints List & Reordering */}
            {activeTab === 'waypoints' && activePatrol && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" /> Secuencia de Puntos:
                  </span>
                  <span className="text-[10px] text-slate-400">{activePatrol.routeWaypoints.length} waypoints</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {activePatrol.routeWaypoints.map((wp, index) => {
                    const prevWp = index > 0 ? activePatrol.routeWaypoints[index - 1] : null;
                    const legMeters = prevWp ? calculateDistanceMeters(prevWp[0], prevWp[1], wp[0], wp[1]) : 0;
                    const isStart = index === 0;
                    const isEnd = index === activePatrol.routeWaypoints.length - 1;

                    return (
                      <div
                        key={index}
                        className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-[10px] hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full font-bold flex items-center justify-center shrink-0 text-[10px] ${
                              isStart
                                ? 'bg-emerald-950 border border-emerald-500 text-emerald-400'
                                : isEnd
                                ? 'bg-rose-950 border border-rose-500 text-rose-400'
                                : 'bg-slate-900 border border-cyan-500/60 text-cyan-300'
                            }`}
                          >
                            {isStart ? '🚩' : isEnd ? '🎯' : index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-200 truncate">
                              WP-{index + 1}: {wp[0].toFixed(5)}, {wp[1].toFixed(5)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {isStart ? 'Punto de Partida' : `+${legMeters}m de WP-${index}`} | MGRS: {latLngToMGRS(wp[0], wp[1])}
                            </p>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            disabled={index === 0}
                            onClick={() => handleMoveWaypoint(index, 'UP')}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-20 cursor-pointer"
                            title="Subir orden"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            disabled={index === activePatrol.routeWaypoints.length - 1}
                            onClick={() => handleMoveWaypoint(index, 'DOWN')}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-20 cursor-pointer"
                            title="Bajar orden"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemoveWaypoint(index)}
                            className="p-1 hover:bg-red-950 text-red-400 hover:text-red-300 rounded ml-0.5 cursor-pointer"
                            title="Eliminar waypoint"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: Assigned Personnel */}
            {activeTab === 'personnel' && activePatrol && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-cyan-400" /> Operadores de la Patrulla:
                  </span>
                  <span className="text-[10px] text-slate-400">{assignedSoldiers.length} asignados</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {assignedSoldiers.length > 0 ? (
                    assignedSoldiers.map((soldier) => (
                      <div
                        key={soldier.id}
                        className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between text-[10px]"
                      >
                        <div>
                          <p className="font-bold text-cyan-300">{soldier.callsign}</p>
                          <p className="text-[9px] text-slate-400">{soldier.name} - {soldier.role}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                            soldier.status === 'OPERATIVO' || soldier.status === 'PATRULLAJE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {soldier.status}
                          </span>
                          <p className="text-[9px] text-slate-400 mt-0.5">{soldier.vitals.heartRate} BPM</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-500 text-[10px]">
                      Líder asignado: {activePatrol.leaderCallsign} ({activePatrol.squad})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
