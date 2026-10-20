import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import { Soldier, TacticalZone, TacticalAlert, TacticalMarker, TacticalPatrol } from '../types';
import { 
  Layers, 
  Crosshair, 
  MapPin, 
  Eye, 
  EyeOff, 
  Radio, 
  Navigation, 
  Compass, 
  AlertTriangle, 
  Heart, 
  Thermometer, 
  Wind, 
  ShieldAlert,
  ShieldCheck,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  Building2,
  Footprints,
  X,
  Lock,
  Unlock,
  Radar,
  Mountain,
  Filter,
  Users,
  Activity,
  FilterX,
  Trash2,
  Sparkles,
  Zap,
  Route,
  LocateFixed,
  Target
} from 'lucide-react';
import { latLngToMGRS } from '../utils/cryptoUtils';
import { sendProximityAlert } from '../utils/pushNotificationService';
import { tacticalAudio } from '../utils/audioAlerts';
import { TerrainElevationProfile } from './TerrainElevationProfile';
import { PatrolRouteVisualizer } from './PatrolRouteVisualizer';

interface TacticalMapProps {
  soldiers: Soldier[];
  zones: TacticalZone[];
  alerts: TacticalAlert[];
  selectedSoldierId: string | null;
  onSelectSoldier: (id: string) => void;
  baseCenter: [number, number];
  playbackIndex?: number | null;
  sharedMarkers: TacticalMarker[];
  onAddTacticalMarker: (marker: Omit<TacticalMarker, 'id' | 'createdAt' | 'status'>) => void;
  onResolveTacticalMarker: (id: string, title: string) => void;
  onCleanOldTacticalMarkers?: (minutes?: number) => Promise<number>;
  patrols?: TacticalPatrol[];
  onUpdatePatrols?: (patrols: TacticalPatrol[]) => void;
}

type MapLayerType = 'satellite' | 'dark' | 'topo';

// Accurate geodetic projection formula
const projectCoordinate = (lat: number, lng: number, distanceMeters: number, bearingDegrees: number): [number, number] => {
  const R = 6378137; // Earth radius in meters
  const bearingRad = (bearingDegrees * Math.PI) / 180;
  
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  
  const nextLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceMeters / R) +
    Math.cos(latRad) * Math.sin(distanceMeters / R) * Math.cos(bearingRad)
  );
  const nextLngRad = lngRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceMeters / R) * Math.cos(latRad),
    Math.cos(distanceMeters / R) - Math.sin(latRad) * Math.sin(nextLatRad)
  );
  
  return [
    (nextLatRad * 180) / Math.PI,
    (nextLngRad * 180) / Math.PI
  ];
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  soldiers,
  zones,
  alerts,
  selectedSoldierId,
  onSelectSoldier,
  baseCenter,
  playbackIndex = null,
  sharedMarkers,
  onAddTacticalMarker,
  onResolveTacticalMarker,
  onCleanOldTacticalMarkers,
  patrols = [],
  onUpdatePatrols,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polygonsRef = useRef<Map<string, L.Polygon>>(new Map());
  const breadcrumbLinesRef = useRef<Map<string, L.Polyline>>(new Map());
  
  // Patrol Route Visualizer Overlay state
  const [showPatrolRouteVisualizer, setShowPatrolRouteVisualizer] = useState<boolean>(true);
  const [selectedPatrolId, setSelectedPatrolId] = useState<string | null>(patrols[0]?.id || null);

  // Auto-Follow Selected Operator (centrar automáticamente y mantener en vista en 2D)
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState<boolean>(false);
  const lastFollowCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  
  // Prediction layers refs
  const predictionConesRef = useRef<Map<string, L.Polygon>>(new Map());
  const predictionLinesRef = useRef<Map<string, L.Polyline>>(new Map());

  // Proximity Radar Layers Refs
  const proximityVectorsRef = useRef<Map<string, L.Polyline>>(new Map());
  const proximityCirclesRef = useRef<Map<string, L.Circle>>(new Map());

  // Base map layers
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('satellite');
  
  // Overlays
  const [showGeofences, setShowGeofences] = useState<boolean>(true);
  const [showTacticalPoints, setShowTacticalPoints] = useState<boolean>(true);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState<boolean>(true);
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showD3Heatmap, setShowD3Heatmap] = useState<boolean>(true);
  const [heatmapLoaded, setHeatmapLoaded] = useState<boolean>(false);
  const d3HeatmapGroupRef = useRef<L.LayerGroup | null>(null);

  // Proximity Radar States
  const [showProximityRadar, setShowProximityRadar] = useState<boolean>(true);
  const [proximitySafetyRadius, setProximitySafetyRadius] = useState<number>(100); // Default 100m
  const [isProximityControlOpen, setIsProximityControlOpen] = useState<boolean>(false);
  const [activeProximityConflicts, setActiveProximityConflicts] = useState<Array<{
    pairKey: string;
    s1: Soldier;
    s2: Soldier;
    distanceMeters: number;
  }>>([]);

  // Topographic Elevation Profile States
  const [showElevationProfile, setShowElevationProfile] = useState<boolean>(true);
  const elevationHoverMarkerRef = useRef<L.CircleMarker | null>(null);

  // Map Side Filter States for Personnel Nodes
  const [selectedSquadFilter, setSelectedSquadFilter] = useState<string>('TODAS');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'TODOS' | 'OPERATIVO' | 'ALERTA' | 'CRITICO'>('TODOS');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);

  // Clean Map Mode Toggle (removes all text legends, overlays and panels covering the map view)
  const [isCleanMapMode, setIsCleanMapMode] = useState<boolean>(false);

  // Map Cleaning States
  const [isCleaningMarkers, setIsCleaningMarkers] = useState<boolean>(false);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);

  // Count temporary markers older than 10 minutes
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const oldMarkersCount = useMemo(() => {
    const now = Date.now();
    return sharedMarkers.filter((m) => (now - new Date(m.createdAt).getTime()) > TEN_MINUTES_MS).length;
  }, [sharedMarkers]);

  const handleCleanClick = async () => {
    if (!onCleanOldTacticalMarkers) return;
    setIsCleaningMarkers(true);
    try {
      const count = await onCleanOldTacticalMarkers(10);
      if (count > 0) {
        setCleanFeedback(`🧹 Se eliminaron ${count} marcador(es) de más de 10 min.`);
      } else {
        setCleanFeedback('ℹ️ No hay marcadores con más de 10 minutos de antigüedad.');
      }
    } catch (err) {
      setCleanFeedback('❌ Error al depurar el mapa.');
    } finally {
      setIsCleaningMarkers(false);
      setTimeout(() => setCleanFeedback(null), 4500);
    }
  };

  // Filtered soldiers array for map rendering
  const filteredMapSoldiers = useMemo(() => {
    return soldiers.filter((s) => {
      // Squad filter
      if (selectedSquadFilter !== 'TODAS') {
        if (!s.squad.toLowerCase().includes(selectedSquadFilter.toLowerCase())) {
          return false;
        }
      }
      // Health status filter
      if (selectedStatusFilter !== 'TODOS') {
        if (selectedStatusFilter === 'OPERATIVO' && s.status !== 'OPERATIVO' && s.status !== 'PATRULLAJE') {
          return false;
        }
        if (selectedStatusFilter === 'ALERTA' && s.status !== 'EN_ALERTA' && s.vitals.heartRate <= 125) {
          return false;
        }
        if (selectedStatusFilter === 'CRITICO' && s.status !== 'CRITICO' && s.status !== 'SOS_EMERGENCIA') {
          return false;
        }
      }
      return true;
    });
  }, [soldiers, selectedSquadFilter, selectedStatusFilter]);

  // Handle elevation profile graph hover sync with Leaflet map
  const handleHoverElevationPoint = (point: { lat: number; lng: number; altitude: number } | null) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!point) {
      if (elevationHoverMarkerRef.current) {
        map.removeLayer(elevationHoverMarkerRef.current);
        elevationHoverMarkerRef.current = null;
      }
      return;
    }

    if (elevationHoverMarkerRef.current) {
      elevationHoverMarkerRef.current.setLatLng([point.lat, point.lng]);
    } else {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: '#ef4444',
        fillColor: '#38bdf8',
        fillOpacity: 0.9,
        weight: 3.5,
      }).addTo(map);

      marker.bindTooltip(
        `<div class="p-1 bg-slate-900 border border-cyan-400 rounded text-slate-100 font-mono-military text-[10px]">
          <p class="font-bold text-cyan-300">⛰️ COTA TERRENO: ${point.altitude}m</p>
        </div>`,
        { permanent: true, direction: 'top', className: 'leaflet-tactical-tooltip' }
      );

      elevationHoverMarkerRef.current = marker;
    }
  };

  // Dynamically load leaflet.heat after window.L is attached to ensure no ReferenceError
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).L = L;
      import('leaflet.heat')
        .then(() => {
          setHeatmapLoaded(true);
        })
        .catch((err) => {
          console.error('Error loading leaflet.heat plugin dynamically:', err);
        });
    }
  }, []);

  // Trajectory Prediction States
  const [showPredictions, setShowPredictions] = useState<boolean>(true);
  const [predictionTime, setPredictionTime] = useState<number>(60); // 60s
  const [predictionSpread, setPredictionSpread] = useState<number>(25); // +/- 25 degrees
  const [predictionScope, setPredictionScope] = useState<'all' | 'selected'>('all');
  
  // Specific Zone Type Visibility Checkboxes (HQ, PATRULLA, RIESGO)
  const [visibleZoneTypes, setVisibleZoneTypes] = useState<{
    HQ: boolean;
    PATRULLA: boolean;
    RIESGO: boolean;
  }>({
    HQ: true,
    PATRULLA: true,
    RIESGO: true,
  });

  // Expandable control panels state
  const [isLayerControlOpen, setIsLayerControlOpen] = useState<boolean>(false);
  const [isPredictionControlOpen, setIsPredictionControlOpen] = useState<boolean>(false);

  // Threat Proximity Radar State (<50m threat warning)
  const [activeThreatProximityAlerts, setActiveThreatProximityAlerts] = useState<Array<{
    soldierId: string;
    soldierCallsign: string;
    threatId: string;
    threatTitle: string;
    distanceMeters: number;
    lat: number;
    lng: number;
  }>>([]);

  // Map locking and HUD visibility
  const [isMapLocked, setIsMapLocked] = useState<boolean>(false);
  const [showHUD, setShowHUD] = useState<boolean>(true);

  // Map zoom level tracking
  const [mapZoom, setMapZoom] = useState<number>(15);

  // Manual Tactical Marker Placement States
  const [placementMode, setPlacementMode] = useState<'threat' | 'obstacle' | null>(null);
  const [pendingMarkerCoords, setPendingMarkerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isAddingMarkerModalOpen, setIsAddingMarkerModalOpen] = useState<boolean>(false);
  const [newMarkerTitle, setNewMarkerTitle] = useState<string>('');
  const [newMarkerDesc, setNewMarkerDesc] = useState<string>('');
  const [newMarkerCreator, setNewMarkerCreator] = useState<string>('Operador C4I (Mando)');

  const sharedMarkersInstanceRef = useRef<Map<string, L.Marker>>(new Map());

  // Reset HUD visibility on soldier selection change
  useEffect(() => {
    if (selectedSoldierId) {
      setShowHUD(true);
    }
  }, [selectedSoldierId]);

  // Dynamic Map Lock Controlling
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (isMapLocked) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      // @ts-ignore
      if (map.tap) map.tap.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      // @ts-ignore
      if (map.tap) map.tap.enable();
    }
  }, [isMapLocked]);

  // Crosshair tracking
  const [cursorMGRS, setCursorMGRS] = useState<string>('18N TK 48200 76300');
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number }>({
    lat: baseCenter[0],
    lng: baseCenter[1],
  });

  // Layer Tile URLs
  const tileLayers: Record<MapLayerType, { url: string; attribution: string }> = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; World Imagery',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'Map data: &copy; OpenStreetMap contributors, OpenTopoMap',
    },
  };

  // Helper to categorize zone
  const getZoneCategory = (zone: TacticalZone): 'HQ' | 'PATRULLA' | 'RIESGO' => {
    if (zone.category) return zone.category;
    if (zone.riskLevel === 'ZONA_CRITICA_RESTRINGIDA') return 'RIESGO';
    if (zone.riskLevel === 'ALTO_RIESGO' || zone.code.includes('PERIM') || zone.code.includes('RECON')) return 'PATRULLA';
    return 'HQ';
  };

  // Count zones per category
  const hqZonesCount = zones.filter((z) => getZoneCategory(z) === 'HQ').length;
  const patrolZonesCount = zones.filter((z) => getZoneCategory(z) === 'PATRULLA').length;
  const riskZonesCount = zones.filter((z) => getZoneCategory(z) === 'RIESGO').length;

  const totalVisibleCategories = 
    (visibleZoneTypes.HQ ? 1 : 0) +
    (visibleZoneTypes.PATRULLA ? 1 : 0) +
    (visibleZoneTypes.RIESGO ? 1 : 0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: baseCenter,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom tactical zoom control on bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    tileLayerRef.current = L.tileLayer(tileLayers[activeLayer].url, {
      maxZoom: 19,
    }).addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      setCursorMGRS(latLngToMGRS(e.latlng.lat, e.latlng.lng));
    });

    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    // Ensure Leaflet calculates container geometry as soon as layout completes
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(resizeTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Layer Changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(tileLayers[activeLayer].url, {
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
  }, [activeLayer]);

  // Render Geofence Zones based on showGeofences & visibleZoneTypes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old polygons
    polygonsRef.current.forEach((poly) => map.removeLayer(poly));
    polygonsRef.current.clear();

    if (!showGeofences) return;

    zones.forEach((zone) => {
      const category = getZoneCategory(zone);
      // Check if this category is visible
      if (!visibleZoneTypes[category]) return;

      const polygon = L.polygon(zone.coordinates, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: zone.fillOpacity,
        weight: 2,
        dashArray: zone.riskLevel === 'ZONA_CRITICA_RESTRINGIDA' ? '6, 6' : undefined,
      }).addTo(map);

      polygon.bindTooltip(
        `<div class="p-1.5 font-mono-military text-xs">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="w-2 h-2 rounded-full" style="background-color: ${zone.color}"></span>
            <p class="font-bold text-slate-100">${zone.code}</p>
          </div>
          <p class="text-[11px] text-slate-300 font-semibold">${zone.name}</p>
          <div class="mt-1 flex items-center justify-between gap-2">
            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              category === 'RIESGO'
                ? 'bg-red-900 text-red-200 border border-red-700'
                : category === 'PATRULLA'
                ? 'bg-amber-900 text-amber-200 border border-amber-700'
                : 'bg-emerald-900 text-emerald-200 border border-emerald-700'
            }">TIPO: ${category}</span>
            <span class="text-[9px] text-slate-400">${zone.riskLevel.replace(/_/g, ' ')}</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1 max-w-[220px]">${zone.description}</p>
          <div class="mt-1 pt-1 border-t border-slate-800 text-[10px] text-cyan-300 font-bold flex items-center justify-between">
            <span>🎯 Radio Dispersión:</span>
            <span class="text-white">${zone.dispersalRadiusMeters || 100}m</span>
          </div>
        </div>`,
        { sticky: true, className: 'leaflet-tactical-tooltip' }
      );

      polygonsRef.current.set(zone.id, polygon);
    });
  }, [zones, showGeofences, visibleZoneTypes]);

  // Handle Map Clicks for Tactical Marker Placement Mode
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!placementMode) return;
      const { lat, lng } = e.latlng;
      setPendingMarkerCoords({ lat, lng });
      setNewMarkerTitle(placementMode === 'threat' ? 'Amenaza Confirmada' : 'Obstáculo de Terreno');
      setNewMarkerDesc('');
      setIsAddingMarkerModalOpen(true);
      setPlacementMode(null); // deactivate placement mode immediately
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [placementMode]);

  // Render Shared Tactical Markers (Threats / Obstacles) on the terrain
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // If layer toggle is OFF, remove all markers from map
    if (!showTacticalPoints) {
      sharedMarkersInstanceRef.current.forEach((marker) => {
        map.removeLayer(marker);
      });
      sharedMarkersInstanceRef.current.clear();
      return;
    }

    // Clear removed markers
    sharedMarkersInstanceRef.current.forEach((marker, id) => {
      const stillExists = sharedMarkers.some((m) => m.id === id);
      if (!stillExists) {
        map.removeLayer(marker);
        sharedMarkersInstanceRef.current.delete(id);
      }
    });

    // Add or update markers
    sharedMarkers.forEach((m) => {
      const isThreat = m.type === 'threat';
      const color = isThreat ? '#ef4444' : '#f59e0b';
      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer">
          <div class="absolute w-8 h-8 rounded-full ${isThreat ? 'bg-red-500/20 animate-ping' : 'bg-amber-500/15 animate-pulse'}"></div>
          <div class="w-7 h-7 rounded-lg border-2 flex items-center justify-center shadow-lg transition-transform hover:scale-110" style="background-color: #0f172a; border-color: ${color}; color: ${color}">
            <span class="text-xs">${isThreat ? '🔴' : '⚠️'}</span>
          </div>
          <!-- Node Title Badge -->
          <div class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-slate-950/95 border border-slate-700 text-[9.5px] font-mono-military font-bold whitespace-nowrap shadow-xl pointer-events-none flex items-center gap-1 backdrop-blur-sm" style="color: ${color}">
            <span>${m.title}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-tactical-shared-marker',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (sharedMarkersInstanceRef.current.has(m.id)) {
        const marker = sharedMarkersInstanceRef.current.get(m.id)!;
        marker.setLatLng([m.lat, m.lng]);
        marker.setIcon(customIcon);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);

        // Build a highly-detailed military tactical popup
        const popupContent = document.createElement('div');
        popupContent.className = 'p-2 bg-slate-900 text-slate-100 rounded-lg text-xs border border-slate-700 font-sans w-56';
        
        popupContent.innerHTML = `
          <div class="flex items-center justify-between gap-1 border-b border-slate-800 pb-1.5 mb-1.5">
            <span class="font-bold uppercase tracking-wider text-[10px]" style="color: ${color}">
              ${isThreat ? '🚨 Amenaza' : '⚠️ Obstáculo'}
            </span>
            <span class="text-[9px] text-slate-400 font-mono-military">${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="font-bold text-[11px] mb-1 text-slate-200">${m.title}</p>
          <p class="text-slate-400 text-[10px] mb-2 leading-relaxed">${m.description}</p>
          
          <div class="text-[9px] text-slate-500 mb-2 font-mono leading-normal border-t border-dashed border-slate-800 pt-1.5">
            <div>COORD: ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</div>
            <div>MGRS: ${latLngToMGRS(m.lat, m.lng)}</div>
            <div>POR: ${m.createdBy}</div>
          </div>
          <button id="btn-resolve-marker-${m.id}" class="w-full py-1 px-2 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold tracking-wider transition-colors uppercase font-mono-military cursor-pointer">
            ✅ Resolver / Limpiar
          </button>
        `;

        marker.bindPopup(popupContent, {
          closeButton: false,
          className: 'custom-military-popup',
        });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-resolve-marker-${m.id}`);
          if (btn) {
            btn.onclick = () => {
              onResolveTacticalMarker(m.id, m.title);
              map.closePopup();
            };
          }
        });

        sharedMarkersInstanceRef.current.set(m.id, marker);
      }
    });
  }, [sharedMarkers, showTacticalPoints]);

  // Render Soldiers & Breadcrumbs with custom distance-based spatial clustering
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 1. Calculate clusters dynamically based on map zoom level
    const threshold = 0.035 / Math.pow(2, mapZoom - 10);
    const visited = new Set<string>();

    interface RenderableUnit {
      isCluster: boolean;
      id: string;
      lat: number;
      lng: number;
      soldiers: Soldier[];
      soldier?: Soldier;
    }

    const renderableMarkers: RenderableUnit[] = [];

    for (let i = 0; i < filteredMapSoldiers.length; i++) {
      const s1 = filteredMapSoldiers[i];
      if (visited.has(s1.id)) continue;

      const clusterGroup: Soldier[] = [s1];
      for (let j = i + 1; j < filteredMapSoldiers.length; j++) {
        const s2 = filteredMapSoldiers[j];
        if (visited.has(s2.id)) continue;

        // Euclidean distance in coordinate degrees
        const dist = Math.sqrt(
          Math.pow(s1.location.lat - s2.location.lat, 2) +
          Math.pow(s1.location.lng - s2.location.lng, 2)
        );

        if (dist < threshold) {
          clusterGroup.push(s2);
        }
      }

      if (clusterGroup.length > 1) {
        // Compute average center coordinates for cluster
        let sumLat = 0;
        let sumLng = 0;
        clusterGroup.forEach((s) => {
          sumLat += s.location.lat;
          sumLng += s.location.lng;
          visited.add(s.id);
        });
        renderableMarkers.push({
          isCluster: true,
          id: `cluster-${s1.id}`,
          lat: sumLat / clusterGroup.length,
          lng: sumLng / clusterGroup.length,
          soldiers: clusterGroup,
        });
      } else {
        visited.add(s1.id);
        renderableMarkers.push({
          isCluster: false,
          id: s1.id,
          lat: s1.location.lat,
          lng: s1.location.lng,
          soldiers: [s1],
          soldier: s1,
        });
      }
    }

    // 2. Clear obsolete markers
    const currentRenderableIds = new Set(renderableMarkers.map((rm) => rm.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentRenderableIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    // 3. Clear obsolete breadcrumb lines
    const currentSoldierIds = new Set(soldiers.map((s) => s.id));
    breadcrumbLinesRef.current.forEach((line, id) => {
      if (!currentSoldierIds.has(id)) {
        map.removeLayer(line);
        breadcrumbLinesRef.current.delete(id);
      }
    });

    // 4. Render clustered or individual markers
    renderableMarkers.forEach((rm) => {
      if (rm.isCluster) {
        const hasEmergency = rm.soldiers.some((s) => s.status === 'SOS_EMERGENCIA' || s.status === 'CRITICO');
        const count = rm.soldiers.length;
        const color = hasEmergency ? '#ef4444' : '#10b981';

        const clusterIconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer">
            <div class="absolute w-12 h-12 rounded-full ${hasEmergency ? 'bg-red-500/20 animate-ping' : 'bg-emerald-500/10 animate-pulse'}"></div>
            <div class="w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center shadow-2xl transition-transform hover:scale-110" style="background-color: #0f172a; border-color: ${color};">
              <span class="text-xs font-bold text-slate-100 font-mono-military">${count}</span>
              <span class="text-[7.5px] tracking-tighter text-slate-400 font-semibold uppercase font-mono-military" style="color: ${color}">UNI</span>
            </div>
            <!-- Sublabel Pin -->
            <div class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-slate-950/95 border ${hasEmergency ? 'border-red-500/80 text-red-300' : 'border-emerald-500/60 text-emerald-300'} text-[9.5px] font-mono-military font-bold whitespace-nowrap shadow-xl pointer-events-none flex items-center gap-1.5 backdrop-blur-sm">
              <span class="w-1.5 h-1.5 rounded-full ${hasEmergency ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}"></span>
              <span>GRUPO: ${count} OPERADORES</span>
            </div>
          </div>
        `;

        const clusterIcon = L.divIcon({
          className: 'custom-military-cluster',
          html: clusterIconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        let marker: L.Marker;
        if (markersRef.current.has(rm.id)) {
          marker = markersRef.current.get(rm.id)!;
          marker.setLatLng([rm.lat, rm.lng]);
          marker.setIcon(clusterIcon);
        } else {
          marker = L.marker([rm.lat, rm.lng], { icon: clusterIcon }).addTo(map);
          markersRef.current.set(rm.id, marker);
        }

        // Build list of units in the cluster for popups
        const listHtml = rm.soldiers
          .map((s) => {
            const isS_Emergency = s.status === 'SOS_EMERGENCIA' || s.status === 'CRITICO';
            const isS_Warning = s.status === 'EN_ALERTA' || s.vitals.heartRate > 125;
            const statusDot = isS_Emergency ? '🔴' : isS_Warning ? '🟡' : '🟢';
            return `
            <div class="flex items-center justify-between gap-1 py-1 border-b border-slate-800/60 hover:bg-slate-800/40 px-1 rounded transition-colors cursor-pointer" id="popup-soldier-select-${s.id}">
              <div class="flex items-center gap-1.5">
                <span>${statusDot}</span>
                <div>
                  <p class="font-bold font-mono-military text-emerald-400 text-[10px]">${s.callsign}</p>
                  <p class="text-[8.5px] text-slate-400">${s.role.substring(0, 18)}</p>
                </div>
              </div>
              <div class="text-right font-mono text-[9px]">
                <p class="${isS_Emergency ? 'text-red-400 font-bold' : 'text-slate-100'}">${s.vitals.heartRate} BPM</p>
                <p class="text-slate-400">SpO2: ${s.vitals.oxygenSaturation}%</p>
              </div>
            </div>
          `;
          })
          .join('');

        const popupContent = document.createElement('div');
        popupContent.className = 'p-2 bg-slate-900 text-slate-100 rounded-lg text-xs border border-slate-700 font-sans w-60';
        popupContent.innerHTML = `
          <div class="flex items-center justify-between gap-1 border-b border-slate-800 pb-1.5 mb-1.5">
            <span class="font-bold uppercase tracking-wider text-[10px] text-emerald-400 font-mono-military">
              👥 GRUPO TÁCTICO
            </span>
            <span class="text-[9px] text-slate-400 font-mono-military">${count} unidades</span>
          </div>
          <div class="max-h-36 overflow-y-auto pr-1 space-y-0.5 mb-2">
            ${listHtml}
          </div>
          <button id="btn-cluster-zoom-${rm.id}" class="w-full py-1.5 px-2 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold tracking-wider transition-colors uppercase font-mono-military cursor-pointer flex items-center justify-center gap-1">
            🔍 Acercar Zona
          </button>
        `;

        marker.bindPopup(popupContent, {
          closeButton: false,
          className: 'custom-military-popup',
        });

        marker.on('popupopen', () => {
          rm.soldiers.forEach((s) => {
            const btnSel = document.getElementById(`popup-soldier-select-${s.id}`);
            if (btnSel) {
              btnSel.onclick = () => {
                onSelectSoldier(s.id);
                marker.closePopup();
              };
            }
          });

          const zoomBtn = document.getElementById(`btn-cluster-zoom-${rm.id}`);
          if (zoomBtn) {
            zoomBtn.onclick = () => {
              map.setView([rm.lat, rm.lng], map.getZoom() + 2);
              map.closePopup();
            };
          }
        });

      } else {
        // Individual marker
        const soldier = rm.soldier!;
        const isSelected = soldier.id === selectedSoldierId;
        const isEmergency = soldier.status === 'SOS_EMERGENCIA' || soldier.status === 'CRITICO';
        const isWarning = soldier.status === 'EN_ALERTA' || soldier.vitals.heartRate > 125;
        const isOutOfBounds = soldier.currentZoneId === 'OUT_OF_BOUNDS';

        const markerBg = isEmergency || isOutOfBounds
          ? '#ef4444'
          : isWarning
          ? '#f59e0b'
          : soldier.isUserDevice
          ? '#38bdf8'
          : '#10b981';

        let lat = soldier.location.lat;
        let lng = soldier.location.lng;
        let hr = soldier.vitals.heartRate;
        let isPlaybackActive = false;

        if (isSelected && playbackIndex !== null && playbackIndex !== undefined && soldier.routeHistory && soldier.routeHistory[playbackIndex]) {
          const point = soldier.routeHistory[playbackIndex];
          lat = point.lat;
          lng = point.lng;
          hr = point.hr;
          isPlaybackActive = true;
        }

        const customIcon = L.divIcon({
          className: 'custom-military-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group">
              ${
                isEmergency
                  ? '<div class="absolute w-12 h-12 rounded-full bg-red-500 opacity-60 animate-ping"></div>'
                  : isOutOfBounds
                  ? '<div class="absolute w-12 h-12 border-2 border-dashed border-red-500 rounded-full bg-red-600/20 opacity-90 animate-pulse"></div><div class="absolute w-10 h-10 rounded-full bg-red-500 opacity-30 animate-ping"></div>'
                  : isSelected
                  ? '<div class="absolute w-10 h-10 rounded-full border-2 border-emerald-400 opacity-80 animate-pulse"></div>'
                  : ''
              }
              <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform ${
                isSelected ? 'scale-125' : ''
              }" style="background-color: #0f172a; border-color: ${markerBg};">
                <span class="text-[10px] font-bold font-mono-military" style="color: ${markerBg}">
                  ${soldier.callsign.substring(0, 2)}
                </span>
              </div>
              <!-- Heading Pointer Arrow -->
              <div class="absolute -top-2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px]"
                   style="border-bottom-color: ${markerBg}; transform: rotate(${soldier.location.heading}deg); transform-origin: 50% 18px;">
              </div>
              <!-- Label Pin -->
              <div class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-slate-950/95 border border-emerald-500/50 text-[9.5px] font-mono-military text-slate-100 whitespace-nowrap shadow-xl pointer-events-none flex items-center gap-1.5 backdrop-blur-sm">
                <span class="font-bold text-emerald-400">${soldier.callsign}</span>
                <span class="w-[1px] h-2.5 bg-slate-700"></span>
                <span class="${isPlaybackActive ? 'text-amber-400 font-bold' : 'text-slate-200'}">${hr} BPM</span>
                ${isPlaybackActive ? '<span class="text-amber-400 animate-pulse text-[8.5px] font-bold">⏱️ REPRODUCIR</span>' : ''}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const hoverTooltipHtml = `
          <div class="p-2 bg-slate-950/95 border border-emerald-500/80 rounded-xl shadow-2xl text-slate-100 font-mono-military text-[10.5px] space-y-1.5 backdrop-blur-md">
            <div class="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
              <span class="font-bold text-emerald-400 font-tactical text-xs">${soldier.callsign}</span>
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-bold">${soldier.rank}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[10px]">
              <div class="flex items-center gap-1.5 bg-red-950/50 border border-red-500/40 px-2 py-1 rounded-lg">
                <span class="text-red-400 text-xs">❤️</span>
                <div>
                  <span class="text-[8.5px] text-slate-400 block">CARDIACO</span>
                  <span class="font-bold text-slate-100">${hr} BPM</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-500/40 px-2 py-1 rounded-lg">
                <span class="text-emerald-400 text-xs">🔋</span>
                <div>
                  <span class="text-[8.5px] text-slate-400 block">BATERÍA</span>
                  <span class="font-bold text-slate-100">${soldier.device.batteryLevel}%</span>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between gap-1 text-[9px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>SpO2: <strong class="text-slate-200">${soldier.vitals.oxygenSaturation}%</strong></span>
              <span>Escuadra: <strong class="text-cyan-400">${soldier.squad.split(' ')[1] || 'Alfa'}</strong></span>
            </div>
          </div>
        `;

        if (markersRef.current.has(soldier.id)) {
          const marker = markersRef.current.get(soldier.id)!;
          marker.setLatLng([lat, lng]);
          marker.setIcon(customIcon);
          marker.setTooltipContent(hoverTooltipHtml);
        } else {
          const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
          marker.bindTooltip(hoverTooltipHtml, {
            direction: 'top',
            offset: [0, -18],
            opacity: 0.98,
            className: 'tactical-soldier-hover-tooltip',
          });
          marker.on('click', () => {
            onSelectSoldier(soldier.id);
          });
          markersRef.current.set(soldier.id, marker);
        }

        // Always draw breadcrumb trails for selected or non-clustered soldiers when enabled
        if (showBreadcrumbs && soldier.routeHistory && soldier.routeHistory.length > 1) {
          const latLngs = soldier.routeHistory.map((p) => [p.lat, p.lng] as [number, number]);
          if (breadcrumbLinesRef.current.has(soldier.id)) {
            const line = breadcrumbLinesRef.current.get(soldier.id)!;
            line.setLatLngs(latLngs);
          } else {
            const line = L.polyline(latLngs, {
              color: markerBg,
              weight: isSelected ? 3 : 1.5,
              opacity: isSelected ? 0.9 : 0.4,
              dashArray: '4, 4',
            }).addTo(map);
            breadcrumbLinesRef.current.set(soldier.id, line);
          }
        }
      }
    });
  }, [filteredMapSoldiers, selectedSoldierId, showBreadcrumbs, mapZoom, playbackIndex]);

  // Render Trajectory Prediction Cones (Probability Cones)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old predictions
    predictionConesRef.current.forEach((cone) => map.removeLayer(cone));
    predictionConesRef.current.clear();
    predictionLinesRef.current.forEach((line) => map.removeLayer(line));
    predictionLinesRef.current.clear();

    if (!showPredictions) return;

    soldiers.forEach((soldier) => {
      const isSelected = soldier.id === selectedSoldierId;
      
      // Filter by prediction scope
      if (predictionScope === 'selected' && !isSelected) return;

      const isEmergency = soldier.status === 'SOS_EMERGENCIA' || soldier.status === 'CRITICO';
      const isWarning = soldier.status === 'EN_ALERTA' || soldier.vitals.heartRate > 125;

      const color = isEmergency
        ? '#ef4444'
        : isWarning
        ? '#f59e0b'
        : soldier.isUserDevice
        ? '#38bdf8'
        : '#10b981';

      let lat = soldier.location.lat;
      let lng = soldier.location.lng;
      const { heading, speed } = soldier.location;

      if (isSelected && playbackIndex !== null && playbackIndex !== undefined && soldier.routeHistory && soldier.routeHistory[playbackIndex]) {
        const point = soldier.routeHistory[playbackIndex];
        lat = point.lat;
        lng = point.lng;
      }

      // Project based on speed and heading
      // If speed is extremely small, use a minimum speed of 0.4 m/s to display an orientation probability cone
      const effectiveSpeed = speed > 0.1 ? speed : 0.4;
      const distance = effectiveSpeed * predictionTime; // projection distance in meters

      // Generate the curved cone vertices
      const coneCoordinates: [number, number][] = [];
      coneCoordinates.push([lat, lng]); // Tip of cone

      const startAngle = heading - predictionSpread;
      const endAngle = heading + predictionSpread;
      const steps = 8; // Number of curved segments for premium arc look

      for (let i = 0; i <= steps; i++) {
        const angle = (startAngle + (i * (endAngle - startAngle)) / steps + 360) % 360;
        const projected = projectCoordinate(lat, lng, distance, angle);
        coneCoordinates.push(projected);
      }
      coneCoordinates.push([lat, lng]); // Close back to tip

      // Create Leaflet Polygon for the cone of probability
      const conePolygon = L.polygon(coneCoordinates, {
        color: color,
        fillColor: color,
        fillOpacity: isSelected ? 0.22 : 0.12,
        weight: isSelected ? 1.5 : 1,
        dashArray: '3, 3',
        interactive: true,
      }).addTo(map);

      // Bind detailed interactive tactical tooltip
      conePolygon.bindTooltip(
        `<div class="p-2.5 font-mono-military text-xs space-y-1.5 min-w-[240px]">
          <div class="flex items-center gap-1.5 border-b border-slate-700 pb-1.5 mb-1">
            <span class="w-2.5 h-2.5 rounded-full animate-pulse" style="background-color: ${color}"></span>
            <span class="font-bold text-slate-100">PROYECCIÓN TÁCTICA: ${soldier.callsign}</span>
          </div>
          <div class="space-y-1 text-[11px]">
            <div class="flex justify-between">
              <span class="text-slate-400">Ventana Temporal:</span>
              <span class="text-slate-200 font-bold">${predictionTime} segundos</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Velocidad Actual:</span>
              <span class="text-slate-200 font-bold">${speed.toFixed(1)} m/s (${(speed * 3.6).toFixed(1)} km/h)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Rumbo de Brújula:</span>
              <span class="text-slate-200 font-bold">${heading}° (&plusmn;${predictionSpread}°)</span>
            </div>
            <div class="flex justify-between border-t border-slate-800 pt-1 mt-1 text-cyan-400">
              <span class="font-semibold text-slate-300">Alcance Proyectado:</span>
              <span class="font-bold">${distance.toFixed(1)} metros</span>
            </div>
          </div>
          <p class="text-[9px] text-slate-500 italic leading-snug border-t border-slate-800 pt-1 mt-1">
            Cono de probabilidad de dispersión calculado sobre el geoide terrestre.
          </p>
        </div>`,
        { sticky: true, className: 'leaflet-tactical-tooltip' }
      );

      predictionConesRef.current.set(soldier.id, conePolygon);

      // Create Leaflet Polyline for the expected direct track line
      const centerEndPoint = projectCoordinate(lat, lng, distance, heading);
      const trackLine = L.polyline([[lat, lng], centerEndPoint], {
        color: color,
        weight: isSelected ? 2.5 : 1.5,
        opacity: isSelected ? 0.8 : 0.5,
        dashArray: isSelected ? undefined : '5, 5',
      }).addTo(map);

      predictionLinesRef.current.set(soldier.id, trackLine);
    });

    return () => {
      predictionConesRef.current.forEach((cone) => map.removeLayer(cone));
      predictionConesRef.current.clear();
      predictionLinesRef.current.forEach((line) => map.removeLayer(line));
      predictionLinesRef.current.clear();
    };
  }, [soldiers, selectedSoldierId, showPredictions, predictionTime, predictionSpread, predictionScope]);

  // Render Heatmap Layer using leaflet.heat
  const heatLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!mapInstanceRef.current || !heatmapLoaded) return;
    const map = mapInstanceRef.current;
    let isCancelled = false;

    // Remove old heatmap layer
    if (heatLayerRef.current) {
      try {
        map.removeLayer(heatLayerRef.current);
      } catch {
        // Safe remove
      }
      heatLayerRef.current = null;
    }

    if (showHeatmap) {
      // Gather routeHistory points from all soldiers representing movement density over last 6 hours
      const heatPoints: [number, number, number][] = [];
      soldiers.forEach((soldier) => {
        // Historical trajectory density
        if (soldier.routeHistory) {
          soldier.routeHistory.forEach((point) => {
            heatPoints.push([point.lat, point.lng, 0.55]);
          });
        }
        // Current positions are hotter (more recent)
        heatPoints.push([soldier.location.lat, soldier.location.lng, 0.95]);
      });

      if (heatPoints.length > 0) {
        const attachHeatLayer = () => {
          if (isCancelled || !mapInstanceRef.current) return;
          const currentMap = mapInstanceRef.current;
          const container = currentMap.getContainer();
          const size = currentMap.getSize();

          // Ensure container and map dimensions are non-zero to prevent canvas IndexSizeError
          if (!container || !size || size.x <= 0 || size.y <= 0 || container.clientWidth <= 0 || container.clientHeight <= 0) {
            currentMap.once('resize', () => {
              if (!isCancelled) attachHeatLayer();
            });
            return;
          }

          try {
            // @ts-ignore
            const layer: any = (L as any).heatLayer(heatPoints, {
              radius: 25,
              blur: 15,
              maxZoom: 18,
              gradient: {
                0.4: 'blue',
                0.6: 'cyan',
                0.7: 'lime',
                0.8: 'yellow',
                1.0: 'red'
              }
            });

            // Safeguard internal _reset and _redraw against zero-dimension canvas crashes
            const origReset = layer._reset;
            layer._reset = function () {
              if (!this._map) return;
              const sz = this._map.getSize();
              if (!sz || sz.x <= 0 || sz.y <= 0) return;
              if (origReset) {
                try {
                  origReset.call(this);
                } catch {
                  // Ignore canvas sizing edge cases
                }
              }
            };

            const origRedraw = layer._redraw;
            layer._redraw = function () {
              if (!this._map) return;
              const sz = this._map.getSize();
              if (!sz || sz.x <= 0 || sz.y <= 0) return;
              if (origRedraw) {
                try {
                  origRedraw.call(this);
                } catch {
                  // Ignore redraw errors if canvas width is zero
                }
              }
            };

            if (layer._heat) {
              const origDraw = layer._heat.draw;
              layer._heat.draw = function (minOpacity: number) {
                if (!this._width || !this._height || this._width <= 0 || this._height <= 0) {
                  return this;
                }
                try {
                  return origDraw.call(this, minOpacity);
                } catch {
                  return this;
                }
              };
            }

            layer.addTo(currentMap);
            heatLayerRef.current = layer;
          } catch (e) {
            console.warn("Notice: Heatmap layer deferred until canvas has positive dimensions:", e);
          }
        };

        attachHeatLayer();
      }
    }

    return () => {
      isCancelled = true;
      if (heatLayerRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeLayer(heatLayerRef.current);
        } catch {
          // Safe remove
        }
        heatLayerRef.current = null;
      }
    };
  }, [soldiers, showHeatmap, heatmapLoaded]);

  // Render Dynamic D3.js Patrol Activity Density Heatmap (Last 2 Hours)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (d3HeatmapGroupRef.current) {
      map.removeLayer(d3HeatmapGroupRef.current);
      d3HeatmapGroupRef.current = null;
    }

    if (!showD3Heatmap) return;

    // Collect patrol activity breadcrumbs and positions
    const points: { lat: number; lng: number; weight: number }[] = [];

    soldiers.forEach((soldier) => {
      points.push({ lat: soldier.location.lat, lng: soldier.location.lng, weight: 1.0 });
      if (soldier.routeHistory) {
        soldier.routeHistory.forEach((pt, idx) => {
          const w = 0.4 + (idx / soldier.routeHistory.length) * 0.5;
          points.push({ lat: pt.lat, lng: pt.lng, weight: w });
        });
      }
    });

    if (points.length === 0) return;

    // D3.js sequential scale using Turbo interpolator for military heat map contours
    const colorScale = d3.scaleSequential(d3.interpolateTurbo)
      .domain([0.2, 1.2]);

    const layerGroup = L.layerGroup();

    points.forEach((pt) => {
      const color = colorScale(pt.weight);
      const circle = L.circle([pt.lat, pt.lng], {
        radius: 28 + pt.weight * 22,
        stroke: false,
        fillColor: color,
        fillOpacity: 0.25 * pt.weight,
        interactive: false,
      });
      circle.addTo(layerGroup);
    });

    layerGroup.addTo(map);
    d3HeatmapGroupRef.current = layerGroup;

    return () => {
      if (d3HeatmapGroupRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(d3HeatmapGroupRef.current);
        d3HeatmapGroupRef.current = null;
      }
    };
  }, [soldiers, showD3Heatmap, mapZoom]);

  // Render Proximity Radar Safety Vectors and Halos (Soldier-to-Soldier and Soldier-to-Threat <50m)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old proximity layers
    proximityVectorsRef.current.forEach((line) => map.removeLayer(line));
    proximityVectorsRef.current.clear();
    proximityCirclesRef.current.forEach((circle) => map.removeLayer(circle));
    proximityCirclesRef.current.clear();

    const conflicts: Array<{
      pairKey: string;
      s1: Soldier;
      s2: Soldier;
      distanceMeters: number;
    }> = [];

    const threatAlerts: Array<{
      soldierId: string;
      soldierCallsign: string;
      threatId: string;
      threatTitle: string;
      distanceMeters: number;
      lat: number;
      lng: number;
    }> = [];

    if (!showProximityRadar) {
      setActiveProximityConflicts([]);
      setActiveThreatProximityAlerts([]);
      return;
    }

    // A) SOLDIER-TO-THREAT PROXIMITY RADAR (Anillos concéntricos < 50m)
    const activeThreats = (sharedMarkers || []).filter(m => m.type === 'threat' && m.status === 'active');
    const THREAT_SAFETY_RADIUS = 50; // 50 metros

    soldiers.forEach((soldier) => {
      const soldierLatLng = L.latLng(soldier.location.lat, soldier.location.lng);

      activeThreats.forEach((threat) => {
        const threatLatLng = L.latLng(threat.lat, threat.lng);
        const distanceMeters = soldierLatLng.distanceTo(threatLatLng);

        if (distanceMeters <= THREAT_SAFETY_RADIUS) {
          threatAlerts.push({
            soldierId: soldier.id,
            soldierCallsign: soldier.callsign,
            threatId: threat.id,
            threatTitle: threat.title,
            distanceMeters,
            lat: soldier.location.lat,
            lng: soldier.location.lng,
          });

          const pairKey = `threat-${soldier.id}-${threat.id}`;

          // Draw 3 Concentric Rings around the Soldier (15m, 30m, 50m)
          const ring1 = L.circle([soldier.location.lat, soldier.location.lng], {
            radius: 15,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.35,
            weight: 2.5,
            className: 'animate-ping',
          }).addTo(map);

          const ring2 = L.circle([soldier.location.lat, soldier.location.lng], {
            radius: 30,
            color: '#f97316',
            fillColor: '#f97316',
            fillOpacity: 0.2,
            weight: 2.0,
            dashArray: '4, 4',
          }).addTo(map);

          const ring3 = L.circle([soldier.location.lat, soldier.location.lng], {
            radius: 50,
            color: '#eab308',
            fillColor: '#eab308',
            fillOpacity: 0.1,
            weight: 1.5,
            dashArray: '6, 6',
          }).addTo(map);

          // Draw 2 Concentric Rings around the Threat Marker
          const threatRing1 = L.circle([threat.lat, threat.lng], {
            radius: 15,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.25,
            weight: 2,
          }).addTo(map);

          const threatRing2 = L.circle([threat.lat, threat.lng], {
            radius: 35,
            color: '#f97316',
            fillColor: '#f97316',
            fillOpacity: 0.15,
            weight: 1.5,
            dashArray: '4, 4',
          }).addTo(map);

          // Connecting Pulsating Vector Polyline
          const vectorLine = L.polyline(
            [
              [soldier.location.lat, soldier.location.lng],
              [threat.lat, threat.lng],
            ],
            {
              color: '#ef4444',
              weight: 3,
              opacity: 0.95,
              dashArray: '6, 6',
              className: 'animate-pulse',
            }
          ).addTo(map);

          vectorLine.bindTooltip(
            `<div class="p-2 bg-slate-950 border-2 border-red-500 rounded-xl text-slate-100 font-mono-military text-[11px] shadow-2xl backdrop-blur-md">
              <p class="font-bold text-red-400 flex items-center gap-1">🚨 AMENAZA EN RADAR: ${distanceMeters.toFixed(0)}m</p>
              <p class="text-[10px] text-slate-200 mt-0.5">Operador: <strong class="text-white">${soldier.callsign}</strong></p>
              <p class="text-[9px] text-red-300">Amenaza: "${threat.title}"</p>
              <p class="text-[8px] text-amber-400 mt-0.5">Anillos de Alerta: 15m / 30m / 50m</p>
            </div>`,
            { sticky: true, className: 'leaflet-tactical-tooltip' }
          );

          proximityVectorsRef.current.set(`${pairKey}-line`, vectorLine);
          proximityCirclesRef.current.set(`${pairKey}-r1`, ring1);
          proximityCirclesRef.current.set(`${pairKey}-r2`, ring2);
          proximityCirclesRef.current.set(`${pairKey}-r3`, ring3);
          proximityCirclesRef.current.set(`${pairKey}-tr1`, threatRing1);
          proximityCirclesRef.current.set(`${pairKey}-tr2`, threatRing2);
        }
      });
    });

    // B) SOLDIER-TO-SOLDIER PROXIMITY RADAR
    for (let i = 0; i < soldiers.length; i++) {
      for (let j = i + 1; j < soldiers.length; j++) {
        const s1 = soldiers[i];
        const s2 = soldiers[j];

        const latLng1 = L.latLng(s1.location.lat, s1.location.lng);
        const latLng2 = L.latLng(s2.location.lat, s2.location.lng);
        const distanceMeters = latLng1.distanceTo(latLng2);

        if (distanceMeters < proximitySafetyRadius) {
          const pairKey = `${s1.id}-${s2.id}`;
          conflicts.push({ pairKey, s1, s2, distanceMeters });

          // Draw pulsating crimson vector polyline between the two units
          const vectorLine = L.polyline(
            [
              [s1.location.lat, s1.location.lng],
              [s2.location.lat, s2.location.lng],
            ],
            {
              color: '#ef4444',
              weight: 3,
              opacity: 0.95,
              dashArray: '8, 8',
              className: 'animate-pulse',
            }
          ).addTo(map);

          vectorLine.bindTooltip(
            `<div class="p-1 bg-slate-900 border border-red-500/80 rounded shadow-xl text-slate-100 font-mono-military text-[10px]">
              <p class="font-bold text-red-400">⚠️ RIESGO DE PROXIMIDAD: ${distanceMeters.toFixed(0)}m</p>
              <p class="text-[9px] text-slate-300">${s1.callsign} ↔ ${s2.callsign}</p>
              <p class="text-[8px] text-amber-400">Radio Límite: ${proximitySafetyRadius}m</p>
            </div>`,
            { sticky: true, className: 'leaflet-tactical-tooltip' }
          );

          proximityVectorsRef.current.set(pairKey, vectorLine);

          // Draw safety circles around both units if not drawn yet
          if (!proximityCirclesRef.current.has(s1.id)) {
            const circle1 = L.circle([s1.location.lat, s1.location.lng], {
              radius: proximitySafetyRadius / 2,
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.18,
              weight: 1.5,
              dashArray: '4, 4',
            }).addTo(map);
            proximityCirclesRef.current.set(s1.id, circle1);
          }

          if (!proximityCirclesRef.current.has(s2.id)) {
            const circle2 = L.circle([s2.location.lat, s2.location.lng], {
              radius: proximitySafetyRadius / 2,
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.18,
              weight: 1.5,
              dashArray: '4, 4',
            }).addTo(map);
            proximityCirclesRef.current.set(s2.id, circle2);
          }
        }
      }
    }

    setActiveProximityConflicts(conflicts);
    setActiveThreatProximityAlerts(threatAlerts);

    return () => {
      proximityVectorsRef.current.forEach((line) => map.removeLayer(line));
      proximityVectorsRef.current.clear();
      proximityCirclesRef.current.forEach((circle) => map.removeLayer(circle));
      proximityCirclesRef.current.clear();
    };
  }, [soldiers, sharedMarkers, showProximityRadar, proximitySafetyRadius, playbackIndex]);

  // Auto-track playback marker
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedSoldierId || playbackIndex === null || playbackIndex === undefined) return;
    const soldier = soldiers.find(s => s.id === selectedSoldierId);
    if (soldier && soldier.routeHistory && soldier.routeHistory[playbackIndex]) {
      const point = soldier.routeHistory[playbackIndex];
      mapInstanceRef.current.panTo([point.lat, point.lng]);
    }
  }, [playbackIndex, selectedSoldierId, soldiers]);

  // Sync patrol selection when a soldier on patrol is selected
  useEffect(() => {
    if (!selectedSoldierId || patrols.length === 0) return;
    const matchingPatrol = patrols.find(
      (p) => p.assignedSoldierIds.includes(selectedSoldierId) || p.leaderId === selectedSoldierId
    );
    if (matchingPatrol) {
      setSelectedPatrolId(matchingPatrol.id);
    }
  }, [selectedSoldierId, patrols]);

  // Real-time Auto-Follow effect: centrar y mantener en vista al operador seleccionado mientras se desplaza
  useEffect(() => {
    if (!isAutoFollowEnabled || !mapInstanceRef.current || !selectedSoldierId) return;
    const target = soldiers.find((s) => s.id === selectedSoldierId);
    if (!target) return;

    const map = mapInstanceRef.current;
    const { lat, lng } = target.location;
    const currentCenter = map.getCenter();
    const distanceMeters = map.distance(currentCenter, [lat, lng]);

    const last = lastFollowCoordsRef.current;
    const hasMoved = !last || Math.abs(last.lat - lat) > 0.00002 || Math.abs(last.lng - lng) > 0.00002;

    if (hasMoved || distanceMeters > 5) {
      lastFollowCoordsRef.current = { lat, lng };
      if (distanceMeters > 400) {
        map.flyTo([lat, lng], Math.max(map.getZoom(), 17), { duration: 0.9 });
      } else {
        map.panTo([lat, lng], { animate: true, duration: 0.75 });
      }
    }
  }, [isAutoFollowEnabled, selectedSoldierId, soldiers]);

  // Handler to toggle auto-follow switch
  const handleToggleAutoFollow = () => {
    if (!isAutoFollowEnabled) {
      let targetId = selectedSoldierId;
      if (!targetId && soldiers.length > 0) {
        targetId = soldiers[0].id;
        onSelectSoldier(targetId);
      }
      setIsAutoFollowEnabled(true);
      tacticalAudio.playRadioRoger();

      const target = soldiers.find((s) => s.id === (targetId || selectedSoldierId));
      if (target && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(
          [target.location.lat, target.location.lng],
          Math.max(mapInstanceRef.current.getZoom(), 17),
          { duration: 1.0 }
        );
      }
    } else {
      setIsAutoFollowEnabled(false);
      tacticalAudio.playWarningBeep();
    }
  };

  // Center on selected soldier when selected
  const handleCenterOnSelected = () => {
    if (!selectedSoldierId || !mapInstanceRef.current) return;
    const target = soldiers.find((s) => s.id === selectedSoldierId);
    if (target) {
      mapInstanceRef.current.flyTo([target.location.lat, target.location.lng], 17, {
        duration: 1.2,
      });
    }
  };

  // Center on Base HQ
  const handleCenterBase = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(baseCenter, 15, { duration: 1.2 });
  };

  // Toggle specific zone category
  const toggleZoneCategory = (category: 'HQ' | 'PATRULLA' | 'RIESGO') => {
    setVisibleZoneTypes((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Bulk actions for zone categories
  const handleShowAllZones = () => {
    setShowGeofences(true);
    setVisibleZoneTypes({ HQ: true, PATRULLA: true, RIESGO: true });
  };

  const handleHideAllZones = () => {
    setVisibleZoneTypes({ HQ: false, PATRULLA: false, RIESGO: false });
  };

  const handleOnlyRiskZones = () => {
    setShowGeofences(true);
    setVisibleZoneTypes({ HQ: false, PATRULLA: false, RIESGO: true });
  };

  const selectedSoldier = soldiers.find((s) => s.id === selectedSoldierId);

  // Helper to simulate dropping a threat marker 35 meters from soldier to test proximity radar
  const handleSimulateThreatNearSelected = () => {
    const targetSoldier = selectedSoldier || soldiers[2] || soldiers[0];
    if (!targetSoldier) return;

    // Drop a threat marker ~35 meters east of target soldier
    const threatLat = targetSoldier.location.lat + 0.00018; // ~20m north
    const threatLng = targetSoldier.location.lng + 0.00022; // ~25m east

    if (onAddTacticalMarker) {
      onAddTacticalMarker({
        type: 'threat',
        title: `Amenaza Inminente cerca a ${targetSoldier.callsign}`,
        description: 'Firma térmica sospechosa dentro del radio crítico de 50 metros.',
        lat: threatLat,
        lng: threatLng,
        createdBy: 'Radar de Proximidad C4I',
      });
      setShowProximityRadar(true);
      tacticalAudio.playEmergencySiren();
    }
  };

  return (
    <div className="flex flex-col w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* DOCKED HEADER TOOLBAR ABOVE THE MAP (Zero map tile obstruction!) */}
      {!isCleanMapMode && (
        <div className="bg-slate-900/95 border-b border-slate-800 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2 z-10 font-mono-military text-slate-100">
          
          {/* Base Map Layers & Main Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 border-r border-slate-700/80 pr-2">
              <button
                id="map-layer-sat"
                onClick={() => setActiveLayer('satellite')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLayer === 'satellite'
                    ? 'bg-emerald-600 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SATÉLITE
              </button>
              <button
                id="map-layer-dark"
                onClick={() => setActiveLayer('dark')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLayer === 'dark'
                    ? 'bg-emerald-600 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                NOCTURNO
              </button>
              <button
                id="map-layer-topo"
                onClick={() => setActiveLayer('topo')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLayer === 'topo'
                    ? 'bg-emerald-600 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TOPO
              </button>
            </div>

            {/* Modo Vista Limpia Toggle */}
            <button
              id="map-toggle-clean-mode"
              onClick={() => setIsCleanMapMode(!isCleanMapMode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isCleanMapMode
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold animate-pulse'
                  : 'bg-slate-950/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
              title="Ocultar paneles y leyendas sobre el mapa para máxima visibilidad"
            >
              {isCleanMapMode ? <EyeOff className="w-3.5 h-3.5 text-slate-950" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isCleanMapMode ? 'Mapa Limpio (ON)' : 'Mapa Limpio'}</span>
            </button>

            {/* Capas de Zonas Button */}
            <button
              id="map-toggle-layer-control"
              onClick={() => {
                setIsLayerControlOpen(!isLayerControlOpen);
                setIsPredictionControlOpen(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isLayerControlOpen || showGeofences
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Capas de Zonas</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-200 text-[10px] font-bold">
                {showGeofences ? `${totalVisibleCategories}/3` : 'OFF'}
              </span>
              {isLayerControlOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
              )}
            </button>

            {/* Predicciones Button */}
            <button
              id="map-toggle-prediction-control"
              onClick={() => {
                setIsPredictionControlOpen(!isPredictionControlOpen);
                setIsLayerControlOpen(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isPredictionControlOpen || showPredictions
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Predicciones</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-200 text-[10px] font-bold">
                {showPredictions ? `${predictionTime}s` : 'OFF'}
              </span>
              {isPredictionControlOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
              )}
            </button>
          </div>

          {/* Right Group: Patrol Routes, Elevation, Radar & Marker Tools */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Rutas Patrulla */}
            <button
              id="map-toggle-patrol-visualizer"
              onClick={() => setShowPatrolRouteVisualizer(!showPatrolRouteVisualizer)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                showPatrolRouteVisualizer
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Panel de Rutas e Inspector de Patrullaje"
            >
              <Route className="w-3.5 h-3.5 text-amber-400" />
              <span>Rutas Patrulla</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-900/80 text-amber-200 text-[10px] font-bold">
                {patrols ? patrols.length : 0}
              </span>
            </button>

            {/* Perfil Topográfico */}
            <button
              id="map-toggle-elevation-profile"
              onClick={() => setShowElevationProfile(!showElevationProfile)}
              className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                showElevationProfile
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Mountain className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Perfil Topográfico</span>
            </button>

            {/* Radar Proximidad */}
            <button
              id="map-toggle-proximity-radar"
              onClick={() => setIsProximityControlOpen(!isProximityControlOpen)}
              className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                activeProximityConflicts.length > 0
                  ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse font-bold'
                  : showProximityRadar
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Radar className={`w-3.5 h-3.5 ${activeProximityConflicts.length > 0 ? 'text-red-400 animate-spin' : showProximityRadar ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Radar Proximidad</span>
              {activeProximityConflicts.length > 0 && (
                <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[9px] font-bold">
                  {activeProximityConflicts.length}
                </span>
              )}
            </button>

            {/* Interruptor de Auto-Seguimiento del Operador Seleccionado */}
            <button
              id="map-toggle-auto-follow"
              onClick={handleToggleAutoFollow}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isAutoFollowEnabled
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400 animate-pulse'
                  : 'bg-slate-950/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
              title={
                isAutoFollowEnabled
                  ? 'Auto-Seguimiento ACTIVO: Centra y mantiene en vista al operador mientras se desplaza. Clic para desactivar.'
                  : 'Activar Auto-Seguimiento: Centra automáticamente sobre el operador seleccionado y lo mantiene en vista mientras se mueve.'
              }
            >
              <LocateFixed className={`w-3.5 h-3.5 ${isAutoFollowEnabled ? 'text-slate-950 font-bold animate-spin' : 'text-emerald-400'}`} style={isAutoFollowEnabled ? { animationDuration: '6s' } : undefined} />
              <span className="hidden sm:inline">Auto-Seguimiento</span>
              <span className="sm:hidden">Seguir</span>
              <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-extrabold ${
                isAutoFollowEnabled ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {isAutoFollowEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Centrar HQ */}
            <button
              id="map-center-hq"
              onClick={handleCenterBase}
              className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
              title="Centrar en Base Principal C4I"
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {/* Bloquear mapa */}
            <button
              id="map-toggle-lock"
              onClick={() => setIsMapLocked(!isMapLocked)}
              className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                isMapLocked
                  ? 'bg-amber-950 text-amber-400 border-amber-500/40 shadow-sm'
                  : 'text-slate-300 border-transparent hover:text-amber-400 hover:bg-slate-800'
              }`}
              title={isMapLocked ? "Desbloquear movimiento del mapa" : "Bloquear/Fijar mapa"}
            >
              {isMapLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Tactical Marker Creation Menu */}
            <div className="flex items-center gap-1 border-l border-slate-700/80 pl-2">
              <button
                id="map-add-threat-tool"
                onClick={() => setPlacementMode(placementMode === 'threat' ? null : 'threat')}
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
                  placementMode === 'threat'
                    ? 'bg-red-950 text-red-300 border border-red-500 font-bold'
                    : 'text-red-400 hover:bg-slate-800'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                <span>+ Amenaza</span>
              </button>
              
              <button
                id="map-add-obstacle-tool"
                onClick={() => setPlacementMode(placementMode === 'obstacle' ? null : 'obstacle')}
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
                  placementMode === 'obstacle'
                    ? 'bg-amber-950 text-amber-300 border border-amber-500 font-bold'
                    : 'text-amber-400 hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>+ Obstáculo</span>
              </button>

              {/* Limpiar Mapa Button */}
              <button
                id="map-clean-old-markers-btn"
                onClick={handleCleanClick}
                disabled={isCleaningMarkers}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  oldMarkersCount > 0
                    ? 'bg-amber-950/90 text-amber-300 border-amber-500/70 hover:bg-amber-900 animate-pulse'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                } disabled:opacity-50`}
                title="Eliminar marcadores tácticos temporales con más de 10 minutos"
              >
                <Trash2 className={`w-3.5 h-3.5 ${oldMarkersCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Limpiar Mapa</span>
                <span className={`px-1.5 py-0.2 rounded font-extrabold text-[9.5px] ${
                  oldMarkersCount > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  &gt;10m ({oldMarkersCount})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Map Viewport */}
      <div className="relative w-full h-[400px] sm:h-[500px] md:h-[560px] lg:h-[620px] xl:h-[680px] 2xl:h-[740px] overflow-hidden bg-slate-950">
        {/* Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* TOP OVERLAY: AUTO-FOLLOW ACTIVE BADGE */}
        {isAutoFollowEnabled && selectedSoldier && !isCleanMapMode && (
          <div className="absolute top-3 left-4 z-20 bg-slate-950/90 border border-emerald-500/80 rounded-xl px-3 py-2 text-slate-100 shadow-2xl backdrop-blur-md flex items-center gap-2.5 font-mono-military animate-in fade-in duration-300">
            <div className="relative flex items-center justify-center">
              <LocateFixed className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider">AUTO-SEGUIMIENTO:</span>
                <span className="text-xs font-extrabold text-white">{selectedSoldier.callsign}</span>
              </div>
              <div className="text-[9px] text-slate-300 flex items-center gap-2">
                <span>LAT: {selectedSoldier.location.lat.toFixed(5)}</span>
                <span>LNG: {selectedSoldier.location.lng.toFixed(5)}</span>
                <span className="text-cyan-400 font-bold">{selectedSoldier.location.speed || 0} km/h</span>
              </div>
            </div>
            <button
              onClick={() => setIsAutoFollowEnabled(false)}
              className="ml-1 p-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Desactivar auto-seguimiento"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TOP OVERLAY: THREAT PROXIMITY ALERT (<50M) BANNER */}
        {activeThreatProximityAlerts.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-red-950/95 border-2 border-red-500 rounded-xl px-3 sm:px-4 py-2 text-red-200 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-pulse max-w-[92vw]">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <div className="text-left">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-red-100 flex items-center gap-1.5">
                🚨 RADAR DE PROXIMIDAD: AMENAZA EN RADIO DE 50M
                <span className="text-[9px] bg-red-900 border border-red-600 px-1.5 py-0.2 rounded text-white font-mono">
                  {activeThreatProximityAlerts.length} ALERTA(S)
                </span>
              </p>
              <p className="text-[10px] text-red-300 font-mono truncate max-w-[320px] sm:max-w-[480px]">
                {activeThreatProximityAlerts[0].soldierCallsign} a {activeThreatProximityAlerts[0].distanceMeters.toFixed(0)}m de "{activeThreatProximityAlerts[0].threatTitle}"
              </p>
            </div>
            <button
              onClick={() => {
                if (mapInstanceRef.current && activeThreatProximityAlerts[0]) {
                  mapInstanceRef.current.flyTo(
                    [activeThreatProximityAlerts[0].lat, activeThreatProximityAlerts[0].lng],
                    18
                  );
                }
              }}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] font-mono rounded-lg transition-all shrink-0 cursor-pointer shadow-md"
            >
              Centrar Unidades
            </button>
          </div>
        )}

        {/* Placement Mode Informative Banner Overlay */}
        {placementMode && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-900/95 border border-amber-500/50 text-slate-100 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md animate-bounce max-w-[90%] sm:max-w-none text-center">
            <span className="flex h-2 w-2 relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <p className="text-[11px] sm:text-xs font-mono-military">
              MODO MARCACIÓN: Pulse en el mapa para situar{' '}
              <strong className={placementMode === 'threat' ? 'text-red-400' : 'text-amber-400'}>
                {placementMode === 'threat' ? 'una Amenaza' : 'un Obstáculo'}
              </strong>
            </p>
            <button
              onClick={() => setPlacementMode(null)}
              className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 transition-colors uppercase font-mono-military flex-shrink-0"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Interactive Point Configuration Modal Overlay */}
        {isAddingMarkerModalOpen && pendingMarkerCoords && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-4 shadow-2xl font-sans animate-scale-up">
              <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">
                    {newMarkerTitle.toLowerCase().includes('amenaza') ? '🔴' : '⚠️'}
                  </span>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-100 font-mono-military">
                    Configurar Punto Táctico
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddingMarkerModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1 font-mono-military">
                    Tipo de Registro
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewMarkerTitle('Amenaza Confirmada');
                      }}
                      className={`py-1.5 px-2 rounded-lg border font-mono-military text-[10px] font-semibold transition-all ${
                        newMarkerTitle.toLowerCase().includes('amenaza')
                          ? 'bg-red-950/40 text-red-400 border-red-500/60 shadow-lg'
                          : 'bg-slate-800/40 text-slate-400 border-slate-800'
                      }`}
                    >
                      🔴 AMENAZA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewMarkerTitle('Obstáculo de Terreno');
                      }}
                      className={`py-1.5 px-2 rounded-lg border font-mono-military text-[10px] font-semibold transition-all ${
                        !newMarkerTitle.toLowerCase().includes('amenaza')
                          ? 'bg-amber-950/40 text-amber-400 border-amber-500/60 shadow-lg'
                          : 'bg-slate-800/40 text-slate-400 border-slate-800'
                      }`}
                    >
                      ⚠️ OBSTÁCULO
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1 font-mono-military">
                    Identificador / Título
                  </label>
                  <input
                    type="text"
                    value={newMarkerTitle}
                    onChange={(e) => setNewMarkerTitle(e.target.value)}
                    placeholder="Ej. Avistamiento de Patrulla Hostil"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-emerald-500/60 font-mono-military text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-1 font-mono-military">
                    Descripción Operativa
                  </label>
                  <textarea
                    rows={2}
                    value={newMarkerDesc}
                    onChange={(e) => setNewMarkerDesc(e.target.value)}
                    placeholder="Detalles sobre el punto táctico..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-emerald-500/60 leading-relaxed text-xs"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800/60 rounded-lg p-2 font-mono text-[9.5px] space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>CUADRÍCULA MGRS:</span>
                    <span className="text-cyan-400 font-bold">{latLngToMGRS(pendingMarkerCoords.lat, pendingMarkerCoords.lng)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>COORD LAT:</span>
                    <span className="text-slate-300">{pendingMarkerCoords.lat.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>COORD LNG:</span>
                    <span className="text-slate-300">{pendingMarkerCoords.lng.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-850 pt-1.5 mt-1.5">
                    <span>AUTOR TRASM:</span>
                    <span className="text-emerald-400 uppercase font-mono-military">{newMarkerCreator}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingMarkerModalOpen(false)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] uppercase tracking-wider font-mono-military transition-colors border border-slate-750"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const type = newMarkerTitle.toLowerCase().includes('amenaza') ? 'threat' : 'obstacle';
                    onAddTacticalMarker({
                      type,
                      title: newMarkerTitle,
                      description: newMarkerDesc || "Sin descripción adicional.",
                      lat: pendingMarkerCoords.lat,
                      lng: pendingMarkerCoords.lng,
                      createdBy: newMarkerCreator,
                    });
                    setIsAddingMarkerModalOpen(false);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-wider font-mono-military transition-all shadow-lg shadow-emerald-950/40"
                >
                  Publicar Punto
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Tactical Radar Sweep Overlay - 360° rotation every 5 seconds */}
      {showRadar && !isCleanMapMode && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden flex items-center justify-center opacity-75 sm:opacity-85 transition-opacity duration-500">
          <div className="w-[1000px] h-[1000px] md:w-[1400px] md:h-[1400px] rounded-full border border-emerald-500/30 relative flex items-center justify-center">
            {/* Distance Concentric Rings with MIL Distance Labels */}
            <div className="absolute inset-[15%] rounded-full border border-emerald-500/25 border-dashed flex items-center justify-center">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono-military text-emerald-400/80 font-bold tracking-widest bg-slate-950/80 px-1 rounded">750M</span>
            </div>
            <div className="absolute inset-[30%] rounded-full border border-emerald-500/35 flex items-center justify-center">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono-military text-emerald-400 font-bold tracking-widest bg-slate-950/80 px-1 rounded">500M</span>
            </div>
            <div className="absolute inset-[45%] rounded-full border border-emerald-500/40 border-dashed flex items-center justify-center">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono-military text-cyan-400 font-bold tracking-widest bg-slate-950/80 px-1 rounded">250M</span>
            </div>
            <div className="absolute inset-[60%] rounded-full border border-emerald-500/50 flex items-center justify-center">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono-military text-emerald-300 font-bold tracking-widest bg-slate-950/80 px-1 rounded">100M</span>
            </div>

            {/* Tactical MGRS Crosshairs & Cardinal Indicators */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-emerald-500/60 via-emerald-500/20 to-emerald-500/60" />
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gradient-to-r from-emerald-500/60 via-emerald-500/20 to-emerald-500/60" />
            
            <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-mono-military text-emerald-400 font-black tracking-widest bg-slate-950/90 px-2 py-0.5 rounded border border-emerald-500/40 shadow-lg">N 000°</span>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-mono-military text-emerald-400 font-black tracking-widest bg-slate-950/90 px-2 py-0.5 rounded border border-emerald-500/40 shadow-lg">S 180°</span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-military text-emerald-400 font-black tracking-widest bg-slate-950/90 px-2 py-0.5 rounded border border-emerald-500/40 shadow-lg">E 090°</span>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-military text-emerald-400 font-black tracking-widest bg-slate-950/90 px-2 py-0.5 rounded border border-emerald-500/40 shadow-lg">W 270°</span>

            {/* Rotating 360-degree Radar Beam (5-second continuous rotation) */}
            <div
              className="absolute top-1/2 left-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] origin-top-left animate-radar-5s pointer-events-none rounded-br-full"
              style={{
                background:
                  'conic-gradient(from 0deg at 0% 0%, rgba(16, 185, 129, 0.45) 0deg, rgba(6, 182, 212, 0.25) 30deg, rgba(16, 185, 129, 0.08) 60deg, transparent 90deg)',
              }}
            >
              {/* High-contrast leading scanning edge line */}
              <div className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-emerald-400 via-cyan-300 to-transparent shadow-[0_0_12px_#10b981]" />
            </div>
          </div>
        </div>
      )}

      {/* Top Right: Side Control Filter Panel Overlay for Personnel Nodes */}
      {!isCleanMapMode && (
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-auto">
          <div className="bg-slate-900/95 border border-slate-700/90 rounded-xl p-3 shadow-2xl backdrop-blur-md w-64 max-w-[calc(100vw-2rem)]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-emerald-400" />
                <span className="font-tactical font-bold text-xs text-slate-100 uppercase tracking-wider text-shadow-tactical">
                  Filtro de Personal
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono-military text-[10px] font-bold border border-emerald-500/40">
                  {filteredMapSoldiers.length}/{soldiers.length} NODOS
                </span>
                <button
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title={isFilterPanelOpen ? "Ocultar panel de filtro" : "Mostrar panel de filtro"}
                >
                  {isFilterPanelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isFilterPanelOpen && (
              <div className="space-y-3">
                {/* Squad Filter Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono-military text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span>Por Escuadra</span>
                    </label>
                    {selectedSquadFilter !== 'TODAS' && (
                      <button
                        onClick={() => setSelectedSquadFilter('TODAS')}
                        className="text-[9px] font-mono-military text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <FilterX className="w-2.5 h-2.5" />
                        <span>Limpiar</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {['TODAS', 'Alfa', 'Bravo', 'Cóndor', 'Centinela'].map((sq) => (
                      <button
                        key={sq}
                        onClick={() => setSelectedSquadFilter(sq)}
                        className={`px-2 py-1 rounded text-[10.5px] font-mono-military font-bold transition-all text-left truncate cursor-pointer ${
                          selectedSquadFilter === sq
                            ? 'bg-emerald-600 text-slate-950 shadow-md shadow-emerald-950 border border-emerald-400'
                            : 'bg-slate-950/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-slate-800'
                        }`}
                      >
                        {sq === 'TODAS' ? 'Todas Escuadras' : sq}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Health Status Filter Section */}
                <div className="space-y-1.5 border-t border-slate-800/80 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono-military text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Activity className="w-3 h-3 text-amber-400" />
                      <span>Estado de Salud</span>
                    </label>
                    {selectedStatusFilter !== 'TODOS' && (
                      <button
                        onClick={() => setSelectedStatusFilter('TODOS')}
                        className="text-[9px] font-mono-military text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <FilterX className="w-2.5 h-2.5" />
                        <span>Limpiar</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'TODOS', label: 'Todos Estados' },
                      { id: 'OPERATIVO', label: '🟢 Operativo' },
                      { id: 'ALERTA', label: '🟡 En Alerta' },
                      { id: 'CRITICO', label: '🔴 Crítico / SOS' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setSelectedStatusFilter(st.id as any)}
                        className={`px-2 py-1 rounded text-[10.5px] font-mono-military font-bold transition-all truncate text-left cursor-pointer ${
                          selectedStatusFilter === st.id
                            ? st.id === 'CRITICO'
                              ? 'bg-red-600 text-white shadow-md border border-red-400'
                              : st.id === 'ALERTA'
                              ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-300'
                              : st.id === 'OPERATIVO'
                              ? 'bg-emerald-600 text-slate-950 shadow-md border border-emerald-400'
                              : 'bg-slate-200 text-slate-950 shadow-md border border-slate-400'
                            : 'bg-slate-950/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-slate-800'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layer Visibility Toggles Section */}
                <div className="space-y-1.5 border-t border-slate-800/80 pt-2">
                  <label className="text-[10px] font-mono-military text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span>Visibilidad de Capas</span>
                  </label>
                  <div className="space-y-1">
                    <button
                      onClick={() => setShowGeofences(!showGeofences)}
                      className={`w-full px-2 py-1 rounded text-[10.5px] font-mono-military font-bold flex items-center justify-between transition-all cursor-pointer ${
                        showGeofences
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>🛡️ Zonas de Seguridad</span>
                      <span>{showGeofences ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                      onClick={() => setShowTacticalPoints(!showTacticalPoints)}
                      className={`w-full px-2 py-1 rounded text-[10.5px] font-mono-military font-bold flex items-center justify-between transition-all cursor-pointer ${
                        showTacticalPoints
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>⚠️ Puntos Tácticos</span>
                      <span>{showTacticalPoints ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                      onClick={() => setShowD3Heatmap(!showD3Heatmap)}
                      className={`w-full px-2 py-1 rounded text-[10.5px] font-mono-military font-bold flex items-center justify-between transition-all cursor-pointer ${
                        showD3Heatmap
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>🔥 Heatmap D3 (Patrullaje)</span>
                      <span>{showD3Heatmap ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>

                {/* Temporary Tactical Markers Clean Section */}
                <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono-military text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Trash2 className="w-3 h-3 text-amber-400" />
                      <span>Depurar Marcadores</span>
                    </label>
                    <span className="text-[9.5px] font-mono-military text-slate-400">
                      &gt;10 min: <strong className={oldMarkersCount > 0 ? "text-amber-400" : "text-slate-300"}>{oldMarkersCount}</strong>
                    </span>
                  </div>
                  <button
                    onClick={handleCleanClick}
                    disabled={isCleaningMarkers}
                    className={`w-full py-1.5 px-2 rounded text-[11px] font-mono-military font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      oldMarkersCount > 0
                        ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-md border border-amber-300'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    } disabled:opacity-50`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Limpiar Marcadores (&gt;10 min)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toast Notification Feedback for Map Cleaning */}
      {cleanFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-slate-900/95 border border-amber-500/80 rounded-xl shadow-2xl backdrop-blur-md text-amber-300 font-mono-military text-xs font-bold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{cleanFeedback}</span>
        </div>
      )}

      {/* Top Right: Selected Operator HUD Quick View */}
      {selectedSoldier && showHUD && !isCleanMapMode && (
        <div className={`absolute ${isFilterPanelOpen ? 'top-72 sm:top-80' : 'top-14'} right-3 z-20 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 p-3 shadow-2xl transition-all duration-300`}>
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2.5">
              <img
                src={selectedSoldier.avatar}
                alt={selectedSoldier.name}
                className="w-10 h-10 rounded-lg object-cover border border-slate-600 shadow"
              />
              <div>
                <p className="text-xs font-bold text-emerald-400 font-mono-military">
                  {selectedSoldier.callsign}
                </p>
                <p className="text-[11px] text-slate-300">{selectedSoldier.name}</p>
                <p className="text-[9px] text-slate-400">{selectedSoldier.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                id="btn-hud-center"
                onClick={handleCenterOnSelected}
                className="p-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 transition-colors"
                title="Centrar Cámara en Operador"
              >
                <Crosshair className="w-4 h-4" />
              </button>
              <button
                id="btn-hud-close"
                onClick={() => setShowHUD(false)}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                title="Ocultar HUD de Operador"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Vitals Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
            <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                <Heart className="w-3 h-3 text-red-400" />
                <span>PULSO</span>
              </div>
              <p className={`text-sm font-mono-military font-bold ${
                selectedSoldier.vitals.heartRate > 130 ? 'text-red-400 animate-pulse' : 'text-slate-100'
              }`}>
                {selectedSoldier.vitals.heartRate} <span className="text-[9px] font-normal text-slate-400">BPM</span>
              </p>
            </div>

            <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                <Thermometer className="w-3 h-3 text-amber-400" />
                <span>TEMP</span>
              </div>
              <p className="text-sm font-mono-military font-bold text-slate-100">
                {selectedSoldier.vitals.temperature}°C
              </p>
            </div>

            <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                <Wind className="w-3 h-3 text-cyan-400" />
                <span>SpO2</span>
              </div>
              <p className={`text-sm font-mono-military font-bold ${
                selectedSoldier.vitals.oxygenSaturation < 92 ? 'text-red-400 animate-pulse' : 'text-slate-100'
              }`}>
                {selectedSoldier.vitals.oxygenSaturation}%
              </p>
            </div>
          </div>

          {/* Location details */}
          <div className="bg-slate-950/60 p-2 rounded text-[11px] font-mono-military text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">MGRS:</span>
              <span className="text-cyan-300">{latLngToMGRS(selectedSoldier.location.lat, selectedSoldier.location.lng)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ALTITUD / VELOCIDAD:</span>
              <span>{selectedSoldier.location.altitude}m | {selectedSoldier.location.speed} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">BATERÍA VESTIBLE:</span>
              <span className={selectedSoldier.device.batteryLevel < 30 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                {selectedSoldier.device.batteryLevel}% ({selectedSoldier.device.connectionType})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar: MGRS Crosshair Coordinates & Base Status */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono-military text-slate-300 shadow-xl">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Compass className="w-3.5 h-3.5" />
          <span>MGRS: {cursorMGRS}</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-slate-400 border-l border-slate-700 pl-3">
          <span>LAT: {cursorCoords.lat.toFixed(5)}</span>
          <span>LNG: {cursorCoords.lng.toFixed(5)}</span>
        </div>
        <div className="hidden md:flex items-center gap-1 text-cyan-400 border-l border-slate-700 pl-3">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>GPS RTK: &plusmn;0.5m</span>
        </div>
        {/* Quick Map 2D Auto-Follow Switch on canvas */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700 shadow-xl font-mono-military">
          <button
            onClick={handleToggleAutoFollow}
            className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isAutoFollowEnabled
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow ring-2 ring-emerald-400 animate-pulse'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Interruptor de auto-seguimiento en tiempo real sobre el operador seleccionado"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${isAutoFollowEnabled ? 'animate-spin text-slate-950 font-bold' : 'text-emerald-400'}`} style={isAutoFollowEnabled ? { animationDuration: '6s' } : undefined} />
            <span className="hidden sm:inline">Seguir Operador:</span>
            <span className="sm:hidden">Seguir:</span>
            <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${
              isAutoFollowEnabled ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {isAutoFollowEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      </div>

      {/* Docked Control Panel under the map (Zero overlapping!) */}
      {(showPatrolRouteVisualizer || isLayerControlOpen || isPredictionControlOpen || isProximityControlOpen) && (
        <div className="bg-slate-900 border-t border-slate-800 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono-military text-slate-300">
          
          {/* Patrol Route Visualizer Docked Panel */}
          {showPatrolRouteVisualizer && (
            <div className="md:col-span-1 lg:col-span-1">
              <PatrolRouteVisualizer
                map={mapInstanceRef.current}
                patrols={patrols}
                onUpdatePatrols={onUpdatePatrols}
                selectedPatrolId={selectedPatrolId}
                onSelectPatrolId={(id) => setSelectedPatrolId(id)}
                isVisible={showPatrolRouteVisualizer}
                onToggleVisible={() => setShowPatrolRouteVisualizer(false)}
                soldiers={soldiers}
              />
            </div>
          )}
          
          {/* Proximity Radar Control Panel */}
          {isProximityControlOpen && (
            <div id="tactical-proximity-radar-panel" className="bg-slate-950 rounded-xl border border-cyan-500/50 p-4 space-y-3 flex flex-col justify-between shadow-2xl">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/50">
                      <Radar className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
                      {activeProximityConflicts.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      )}
                    </div>
                    <span className="font-tactical font-bold text-cyan-300 text-sm">
                      RADAR DE PROXIMIDAD TÁCTICO
                    </span>
                  </div>
                  <button
                    onClick={() => setIsProximityControlOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Radar Enable Toggle */}
                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Radar className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-slate-200">Monitoreo de Proximidad</span>
                  </div>
                  <button
                    onClick={() => setShowProximityRadar(!showProximityRadar)}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                      showProximityRadar
                        ? 'bg-emerald-600 text-slate-950 shadow-sm shadow-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {showProximityRadar ? 'ON (ACTIVO)' : 'OFF (DESACTIVADO)'}
                  </button>
                </div>

                {/* Safety Distance Threshold Buttons */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Radio Límite de Seguridad:</span>
                    <span className="text-cyan-400 font-bold text-xs">{proximitySafetyRadius} metros</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                    {[50, 100, 150, 200, 300].map((radius) => (
                      <button
                        key={radius}
                        onClick={() => setProximitySafetyRadius(radius)}
                        className={`py-1.5 rounded border text-center font-bold transition-all ${
                          proximitySafetyRadius === radius
                            ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-950'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {radius}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Threat Proximity Section (<50m Concentric Rings) */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300 font-bold uppercase flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 inline" />
                      Proximidad a Amenazas (&lt;50m):
                    </span>
                    <span className={`font-bold ${activeThreatProximityAlerts.length > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                      {activeThreatProximityAlerts.length > 0 ? `🚨 ${activeThreatProximityAlerts.length} EN PELIGRO` : '✓ SIN AMENAZAS EN 50M'}
                    </span>
                  </div>

                  {activeThreatProximityAlerts.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                      {activeThreatProximityAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-red-950/60 border border-red-500/80 flex items-center justify-between gap-2 shadow-lg"
                        >
                          <div>
                            <p className="font-bold text-red-200 text-xs">
                              🚨 {alert.soldierCallsign}
                            </p>
                            <p className="text-[10px] text-slate-300">
                              Distancia a Amenaza: <strong className="text-amber-400 font-bold">{alert.distanceMeters.toFixed(0)}m</strong>
                            </p>
                            <p className="text-[9px] text-red-300 truncate max-w-[180px]">
                              "{alert.threatTitle}"
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (mapInstanceRef.current) {
                                mapInstanceRef.current.flyTo([alert.lat, alert.lng], 18);
                              }
                            }}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase shadow"
                          >
                            Centrar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400">Sin amenazas a menos de 50 metros.</span>
                      <button
                        onClick={handleSimulateThreatNearSelected}
                        className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        Simular Amenaza (50m)
                      </button>
                    </div>
                  )}
                </div>

                {/* Active Soldier Separation Conflicts List */}
                <div className="space-y-2 pt-2 border-t border-slate-850">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 uppercase font-semibold">Separación de Unidades:</span>
                    <span className={`font-bold ${activeProximityConflicts.length > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                      {activeProximityConflicts.length > 0 ? `⚠️ ${activeProximityConflicts.length} ALERTA(S)` : '✓ PERÍMETRO SEGURO'}
                    </span>
                  </div>

                  {activeProximityConflicts.length === 0 ? (
                    <div className="bg-slate-900/60 p-3 rounded-lg text-center border border-slate-800/80">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      <p className="text-[10px] text-slate-400">
                        Ninguna unidad infringe el radio de seguridad de {proximitySafetyRadius}m.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                      {activeProximityConflicts.map((conflict) => (
                        <div 
                          key={conflict.pairKey}
                          className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/60 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-red-300 text-xs">
                              ⚠️ {conflict.s1.callsign} ↔ {conflict.s2.callsign}
                            </p>
                            <p className="text-[10px] text-slate-300">
                              Distancia: <span className="text-amber-400 font-bold">{conflict.distanceMeters.toFixed(0)}m</span> (Mínimo: {proximitySafetyRadius}m)
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (mapInstanceRef.current) {
                                const midLat = (conflict.s1.location.lat + conflict.s2.location.lat) / 2;
                                const midLng = (conflict.s1.location.lng + conflict.s2.location.lng) / 2;
                                mapInstanceRef.current.flyTo([midLat, midLng], 17);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-red-600/30 hover:bg-red-600/60 text-red-200 border border-red-400/50 text-[10px] font-bold uppercase transition-colors whitespace-nowrap"
                            title="Centrar en Unidades"
                          >
                            Centrar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Expandable Layer Control Panel */}
          {isLayerControlOpen && (
            <div id="tactical-zone-layer-control-panel" className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3 flex flex-col justify-between shadow-inner">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="font-tactical font-bold text-slate-100 text-sm">
                      CONTROL DE CAPAS DE ZONAS
                    </span>
                  </div>
                  <button
                    onClick={() => setIsLayerControlOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Master Toggle */}
                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <label 
                    htmlFor="chk-master-geofences" 
                    className="flex items-center gap-2.5 cursor-pointer text-slate-200 font-semibold"
                  >
                    <input
                      id="chk-master-geofences"
                      type="checkbox"
                      checked={showGeofences}
                      onChange={(e) => setShowGeofences(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer accent-emerald-500"
                    />
                    <span>Habilitar Capa de Geocercas</span>
                  </label>

                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    showGeofences ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {showGeofences ? 'ACTIVO' : 'PAUSADO'}
                  </span>
                </div>

                {/* Zone Categories Checkboxes */}
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">
                    Alternar Visibilidad por Tipo de Zona:
                  </span>

                  {/* 1. HQ / Cuartel General Checkbox */}
                  <div 
                    onClick={() => toggleZoneCategory('HQ')}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                      visibleZoneTypes.HQ && showGeofences
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-900/40 border-slate-850 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <input
                      id="chk-zone-hq"
                      type="checkbox"
                      checked={visibleZoneTypes.HQ && showGeofences}
                      onChange={() => toggleZoneCategory('HQ')}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer accent-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                          Zonas Cuartel General (HQ)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                          {hqZonesCount} ZONAS
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sector Alpha (Puesto Mando C4I), Sector Delta (Helipuerto MEDEVAC)
                      </p>
                    </div>
                  </div>

                  {/* 2. PATRULLA / Perímetro & Reconocimiento Checkbox */}
                  <div 
                    onClick={() => toggleZoneCategory('PATRULLA')}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                      visibleZoneTypes.PATRULLA && showGeofences
                        ? 'bg-amber-950/30 border-amber-500/60 shadow-sm'
                        : 'bg-slate-900/40 border-slate-850 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <input
                      id="chk-zone-patrol"
                      type="checkbox"
                      checked={visibleZoneTypes.PATRULLA && showGeofences}
                      onChange={() => toggleZoneCategory('PATRULLA')}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 cursor-pointer accent-amber-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Footprints className="w-3.5 h-3.5 text-amber-400" />
                          Zonas de Patrulla & Perímetro
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                          {patrolZonesCount} ZONAS
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sector Charlie (Perímetro Playa), Sector Echo (Manglares & Selva Recon)
                      </p>
                    </div>
                  </div>

                  {/* 3. RIESGO / Áreas Críticas & Polvorín Checkbox */}
                  <div 
                    onClick={() => toggleZoneCategory('RIESGO')}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                      visibleZoneTypes.RIESGO && showGeofences
                        ? 'bg-red-950/30 border-red-500/60 shadow-sm shadow-red-950/40'
                        : 'bg-slate-900/40 border-slate-850 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <input
                      id="chk-zone-risk"
                      type="checkbox"
                      checked={visibleZoneTypes.RIESGO && showGeofences}
                      onChange={() => toggleZoneCategory('RIESGO')}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 w-4 h-4 rounded border-slate-700 text-red-500 focus:ring-red-500 bg-slate-900 cursor-pointer accent-red-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-300 flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-red-400" />
                          Zonas de Alto Riesgo & Críticas
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold animate-pulse">
                          {riskZonesCount} ZONAS
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sector Bravo (Polvorín & Depósito de Munición Crítica)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Bulk Presets */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  id="btn-layer-show-all"
                  onClick={handleShowAllZones}
                  className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono-military font-bold transition-colors"
                >
                  Mostrar Todas
                </button>
                <button
                  id="btn-layer-only-risk"
                  onClick={handleOnlyRiskZones}
                  className="flex-1 py-1.5 rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/80 text-[10px] font-mono-military font-bold transition-colors"
                >
                  Solo Riesgo
                </button>
                <button
                  id="btn-layer-hide-all"
                  onClick={handleHideAllZones}
                  className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] font-mono-military transition-colors border border-slate-850"
                >
                  Ocultar
                </button>
              </div>
            </div>
          )}

          {/* Expandable Trajectory Prediction Panel */}
          {isPredictionControlOpen && (
            <div id="tactical-prediction-control-panel" className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3.5 shadow-inner">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="font-tactical font-bold text-slate-100 text-sm uppercase">
                    CONO DE PROBABILIDAD DE RUMBO
                  </span>
                </div>
                <button
                  onClick={() => setIsPredictionControlOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Prediction Master Toggle */}
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <label 
                  htmlFor="chk-master-predictions" 
                  className="flex items-center gap-2.5 cursor-pointer text-slate-200 font-semibold"
                >
                  <input
                    id="chk-master-predictions"
                    type="checkbox"
                    checked={showPredictions}
                    onChange={(e) => setShowPredictions(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer accent-emerald-500"
                  />
                  <span>Habilitar Conos de Predicción</span>
                </label>

                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  showPredictions ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                }`}>
                  {showPredictions ? 'ACTIVO' : 'PAUSADO'}
                </span>
              </div>

              {/* Scope Selection: All vs Selected */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">
                  Ámbito de visualización:
                </span>
                <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-lg border border-slate-850">
                  <button
                    id="btn-scope-all"
                    onClick={() => setPredictionScope('all')}
                    className={`py-1.5 rounded-md text-center text-[10px] font-bold transition-all uppercase ${
                      predictionScope === 'all'
                        ? 'bg-emerald-600 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    Todos los Soldados
                  </button>
                  <button
                    id="btn-scope-selected"
                    onClick={() => setPredictionScope('selected')}
                    className={`py-1.5 rounded-md text-center text-[10px] font-bold transition-all uppercase ${
                      predictionScope === 'selected'
                        ? 'bg-emerald-600 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    Solo Seleccionado
                  </button>
                </div>
              </div>

              {/* Timeframe Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Tiempo de Proyección:</span>
                  <span className="text-cyan-400 font-bold font-mono">{predictionTime} segundos</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[30, 60, 120, 300].map((t) => (
                    <button
                      key={t}
                      onClick={() => setPredictionTime(t)}
                      className={`py-1.5 rounded border text-[10px] font-mono font-bold transition-all ${
                        predictionTime === t
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {t >= 60 ? `${t / 60} MIN` : `${t} SEG`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Uncertainty Spread Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Desviación Angular de Rumbo:</span>
                  <span className="text-emerald-400 font-bold">&plusmn;{predictionSpread}° ({predictionSpread * 2}° Total)</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-850">
                  <span className="text-[10px] text-slate-500">10°</span>
                  <input
                    id="range-prediction-spread"
                    type="range"
                    min="10"
                    max="45"
                    step="5"
                    value={predictionSpread}
                    onChange={(e) => setPredictionSpread(parseInt(e.target.value, 10))}
                    className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">45°</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Topographic Terrain Elevation Profile Panel */}
      {showElevationProfile && selectedSoldier && (
        <div className="mt-3">
          <TerrainElevationProfile
            soldier={selectedSoldier}
            onHoverPoint={handleHoverElevationPoint}
            onClickPoint={(pt) => mapInstanceRef.current?.flyTo([pt.lat, pt.lng], 17)}
          />
        </div>
      )}
    </div>
  );
};
