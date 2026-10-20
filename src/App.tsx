/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Soldier, 
  TacticalZone, 
  TacticalAlert, 
  E2EEPacket, 
  TacticalMessage, 
  TacticalBaseMetrics,
  TacticalMarker,
  TacticalPatrol
} from './types';
import { 
  INITIAL_SOLDIERS, 
  INITIAL_ZONES, 
  INITIAL_ALERTS, 
  INITIAL_MESSAGES, 
  INITIAL_PATROLS,
  BASE_CENTER 
} from './data/tacticalData';
import { NavbarTactical } from './components/NavbarTactical';
import { TacticalMap } from './components/TacticalMap';
import { Tactical3DMapView } from './components/Tactical3DMapView';
import { PersonnelList } from './components/PersonnelList';
import { HealthTelemetryPanel } from './components/HealthTelemetryPanel';
import { AlertsAndDispatchPanel } from './components/AlertsAndDispatchPanel';
import { E2EECloudSecurityModal } from './components/E2EECloudSecurityModal';
import { MetricsDashboardView } from './components/MetricsDashboardView';
import { AiTacticalSitrepModal } from './components/AiTacticalSitrepModal';
import { TacticalCommsDrawer } from './components/TacticalCommsDrawer';
import { DeployOperatorModal } from './components/DeployOperatorModal';
import { SecurityZoneConfigurator } from './components/SecurityZoneConfigurator';
import { createE2EEPacket } from './utils/cryptoUtils';
import { tacticalAudio } from './utils/audioAlerts';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { TacticalBlackout } from './components/TacticalBlackout';
import { MobileBottomNav } from './components/MobileBottomNav';
import { QuickStartOnboarding } from './components/QuickStartOnboarding';
import { sendPersistentNotification, sendHombreCaidoAlert, sendGeofenceAlert } from './utils/pushNotificationService';

// Ray-casting point-in-polygon algorithm to detect geofence violations
function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > lng) !== (yj > lng))
        && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'map' | '3dmap' | 'telemetry' | 'metrics' | 'e2ee'>('map');
  
  // Tactical Domain State
  const [soldiers, setSoldiers] = useState<Soldier[]>(INITIAL_SOLDIERS);
  const [zones, setZones] = useState<TacticalZone[]>(INITIAL_ZONES);
  const [patrols, setPatrols] = useState<TacticalPatrol[]>(INITIAL_PATROLS);
  const [alerts, setAlerts] = useState<TacticalAlert[]>(INITIAL_ALERTS);
  const [messages, setMessages] = useState<TacticalMessage[]>(INITIAL_MESSAGES);
  const [packets, setPackets] = useState<E2EEPacket[]>([]);
  const [selectedSoldierId, setSelectedSoldierId] = useState<string | null>('soldier-1');
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);

  // Simulation & Modal States
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isUserGpsActive, setIsUserGpsActive] = useState<boolean>(false);
  const [isSitrepOpen, setIsSitrepOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isCommsOpen, setIsCommsOpen] = useState<boolean>(false);
  const [isZoneConfiguratorOpen, setIsZoneConfiguratorOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('aegisbase_onboarding_completed');
      return !completed;
    }
    return false;
  });
  const [isDeployOpen, setIsDeployOpen] = useState<boolean>(false);
  const [isBlackout, setIsBlackout] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'QRF' | 'KEY_ROTATION' | null;
    payload?: any;
  } | null>(null);

  const watchGpsIdRef = useRef<number | null>(null);

  // Shared Tactical Markers (Threats / Obstacles) State
  const [sharedMarkers, setSharedMarkers] = useState<TacticalMarker[]>([]);

  // Fetch shared tactical markers from the C4I server
  const fetchSharedMarkers = async () => {
    try {
      const res = await fetch('/api/tactical/markers');
      if (res.ok) {
        const data = await res.json();
        setSharedMarkers(data);
      }
    } catch (err) {
      console.error("Error fetching shared markers:", err);
    }
  };

  useEffect(() => {
    fetchSharedMarkers();
    const interval = setInterval(fetchSharedMarkers, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTacticalMarker = async (marker: Omit<TacticalMarker, 'id' | 'createdAt' | 'status'>) => {
    try {
      const res = await fetch('/api/tactical/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marker),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          fetchSharedMarkers();
          // Add system message about the new tactical marker
          const systemMsg: TacticalMessage = {
            id: `msg-${Date.now()}`,
            sender: 'SISTEMA C4I',
            senderRole: 'Soporte de Enlace Táctico',
            recipient: 'TODOS',
            text: `⚠️ NUEVO PUNTO TÁCTICO: Se ha marcado un(a) [${marker.type === 'threat' ? 'AMENAZA CONFIRMADA' : 'OBSTÁCULO'}] en: "${marker.title}"`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            priority: 'FLASH_OPERACIONAL',
            encrypted: true,
          };
          setMessages(prev => [systemMsg, ...prev]);
          tacticalAudio.playWarningBeep();
        }
      }
    } catch (err) {
      console.error("Error adding tactical marker:", err);
    }
  };

  const handleResolveTacticalMarker = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/tactical/markers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSharedMarkers();
        // Add system message about resolution
        const systemMsg: TacticalMessage = {
          id: `msg-${Date.now()}`,
          sender: 'SISTEMA C4I',
          senderRole: 'Soporte de Enlace Táctico',
          recipient: 'TODOS',
          text: `✅ PUNTO RESUELTO: Se ha desactivado/resuelto el punto táctico: "${title}"`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          priority: 'RUTINA',
          encrypted: true,
        };
        setMessages(prev => [systemMsg, ...prev]);
      }
    } catch (err) {
      console.error("Error resolving tactical marker:", err);
    }
  };

  const handleCleanOldTacticalMarkers = async (minutes: number = 10): Promise<number> => {
    try {
      const res = await fetch('/api/tactical/markers/clean-old', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchSharedMarkers();
        const cleanedCount = data.cleanedCount || 0;

        const systemMsg: TacticalMessage = {
          id: `msg-${Date.now()}`,
          sender: 'SISTEMA C4I',
          senderRole: 'Soporte de Enlace Táctico',
          recipient: 'TODOS',
          text: `🧹 LIMPIEZA DE MAPA: Se han depurado ${cleanedCount} marcador(es) tácticos temporales con más de ${minutes} minutos de antigüedad.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          priority: 'RUTINA',
          encrypted: true,
        };
        setMessages(prev => [systemMsg, ...prev]);
        if (cleanedCount > 0) {
          tacticalAudio.playRadioRoger();
        }
        return cleanedCount;
      }
    } catch (err) {
      console.error("Error cleaning old tactical markers:", err);
    }
    return 0;
  };

  // Initialize initial E2EE packet log
  useEffect(() => {
    const initialPackets = INITIAL_SOLDIERS.map((s) => createE2EEPacket(s));
    setPackets(initialPackets);
  }, []);

  // Real-time Simulation Engine: Patrol Movements & Biometric Micro-fluctuations
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setSoldiers((prevSoldiers) => {
        const updated = prevSoldiers.map((soldier) => {
          // Skip movement if soldier is in SOS emergency, immobilized or real user GPS
          if (soldier.isUserDevice) return soldier;

          const isMoving = soldier.status === 'PATRULLAJE' || soldier.status === 'OPERATIVO';
          let latDelta = 0;
          let lngDelta = 0;
          let newSpeed = soldier.location.speed;
          let newHeading = soldier.location.heading;

          if (isMoving) {
            // Slight wander around patrol route
            latDelta = (Math.random() - 0.5) * 0.00018;
            lngDelta = (Math.random() - 0.5) * 0.00018;
            newSpeed = Math.max(0.8, Math.min(3.2, Number((soldier.location.speed + (Math.random() - 0.5) * 0.4).toFixed(1))));
            newHeading = (soldier.location.heading + Math.floor((Math.random() - 0.5) * 20) + 360) % 360;
          }

          const newLat = soldier.location.lat + latDelta;
          const newLng = soldier.location.lng + lngDelta;

          // Subtle natural vitals fluctuations
          const hrDelta = Math.floor((Math.random() - 0.48) * 3);
          const newHr = Math.max(55, Math.min(180, soldier.vitals.heartRate + hrDelta));
          const newSteps = isMoving ? soldier.vitals.steps + Math.floor(Math.random() * 4) : soldier.vitals.steps;

          // Battery slow discharge
          const newBattery = Math.max(1, soldier.device.batteryLevel - (Math.random() < 0.05 ? 1 : 0));

          // Append to route history occasionally
          const history = [...soldier.routeHistory];
          if (history.length > 25) history.shift();
          if (Math.random() < 0.3) {
            history.push({
              lat: newLat,
              lng: newLng,
              timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              hr: newHr,
              spo2: soldier.vitals.oxygenSaturation,
            });
          }

          // Check if new location is inside any zone
          let matchingZoneId = '';
          INITIAL_ZONES.forEach((zone) => {
            if (isPointInPolygon(newLat, newLng, zone.coordinates)) {
              matchingZoneId = zone.id;
            }
          });
          const currentZoneId = matchingZoneId || 'OUT_OF_BOUNDS';

          return {
            ...soldier,
            location: {
              ...soldier.location,
              lat: newLat,
              lng: newLng,
              speed: newSpeed,
              heading: newHeading,
              lastUpdate: 'Hace 1s',
            },
            vitals: {
              ...soldier.vitals,
              heartRate: newHr,
              steps: newSteps,
            },
            device: {
              ...soldier.device,
              batteryLevel: newBattery,
            },
            currentZoneId,
            routeHistory: history,
          };
        });

        return updated;
      });

      // Generate a new E2EE packet for the selected operator
      const targetSoldier = soldiers.find((s) => s.id === selectedSoldierId) || soldiers[0];
      if (targetSoldier) {
        const newPkt = createE2EEPacket(targetSoldier);
        setPackets((prev) => [newPkt, ...prev.slice(0, 19)]);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isSimulating, selectedSoldierId, soldiers]);

  // Geofencing Real-time Alarm Trigger
  useEffect(() => {
    soldiers.forEach((soldier) => {
      if (soldier.currentZoneId === 'OUT_OF_BOUNDS') {
        const hasActiveGeofenceAlert = alerts.some(
          (a) => a.soldierId === soldier.id && a.type === 'SALIDA_GEOFENCE' && !a.resolved
        );

        if (!hasActiveGeofenceAlert) {
          triggerNewAlert({
            soldierId: soldier.id,
            soldierCallsign: soldier.callsign,
            soldierName: soldier.name,
            type: 'SALIDA_GEOFENCE',
            severity: 'EMERGENCY',
            title: '¡ALERTA GEOFENCE: FUERA DE LÍMITES!',
            description: `El operador ${soldier.callsign} ha salido de todos los perímetros de seguridad táctica de la Base de Coveñas. ¡Peligro inmediato!`,
            location: { lat: soldier.location.lat, lng: soldier.location.lng },
            vitalsSnapshot: {
              heartRate: soldier.vitals.heartRate,
              temperature: soldier.vitals.temperature,
              oxygenSaturation: soldier.vitals.oxygenSaturation,
            },
          });
        }
      }
    });
  }, [soldiers, alerts]);

  // Real Browser GPS Geolocation Integration
  const toggleUserGps = () => {
    if (isUserGpsActive) {
      if (watchGpsIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchGpsIdRef.current);
        watchGpsIdRef.current = null;
      }
      setIsUserGpsActive(false);
      setSoldiers((prev) => prev.filter((s) => !s.isUserDevice));
    } else {
      if (!('geolocation' in navigator)) {
        console.warn('Geolocalización no soportada en este navegador.');
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, altitude, accuracy, speed, heading } = position.coords;
          setIsUserGpsActive(true);

          setSoldiers((prev) => {
            const existing = prev.find((s) => s.isUserDevice);
            
            let userGpsZoneId = '';
            INITIAL_ZONES.forEach((zone) => {
              if (isPointInPolygon(latitude, longitude, zone.coordinates)) {
                userGpsZoneId = zone.id;
              }
            });
            const calculatedZoneId = userGpsZoneId || 'OUT_OF_BOUNDS';

            if (existing) {
              return prev.map((s) =>
                s.isUserDevice
                  ? {
                      ...s,
                      location: {
                        lat: latitude,
                        lng: longitude,
                        altitude: Math.round(altitude || 345),
                        speed: Number((speed || 1.1).toFixed(1)),
                        heading: Math.round(heading || 0),
                        accuracy: Math.round(accuracy || 1.0),
                        lastUpdate: 'En tiempo real (GPS Dispositivo)',
                        isRealGps: true,
                      },
                      currentZoneId: calculatedZoneId,
                    }
                  : s
              );
            } else {
              const userSoldier: Soldier = {
                id: 'soldier-user-gps',
                callsign: 'OPERADOR LOCAL (GPS)',
                name: 'Dispositivo Vinculado en Vivo',
                rank: 'Teniente',
                squad: 'Escuadra Alfa (Vanguardia)',
                role: 'Operador C4I & Drones',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                location: {
                  lat: latitude,
                  lng: longitude,
                  altitude: Math.round(altitude || 345),
                  speed: Number((speed || 1.1).toFixed(1)),
                  heading: Math.round(heading || 0),
                  accuracy: Math.round(accuracy || 1.0),
                  lastUpdate: 'En tiempo real',
                  isRealGps: true,
                },
                vitals: {
                  heartRate: 74,
                  temperature: 36.6,
                  oxygenSaturation: 99,
                  fatigueLevel: 10,
                  stressLevel: 'BAJO',
                  steps: 4200,
                  fallDetected: false,
                  impactGForce: 1.0,
                  ecgStatus: 'NORMAL',
                },
                device: {
                  model: 'Smart Wearable Link (GPS Browser Bridge)',
                  batteryLevel: 99,
                  signalStrength: -55,
                  connectionType: 'ENLACE SATELITAL',
                  encryptionStatus: 'AES-GCM-256 (ACTIVO)',
                  lastSync: 'En tiempo real',
                  encryptionKeyHash: '0xUSER...REAL',
                  firmwareVersion: 'v4.18.2-SEC',
                },
                status: 'OPERATIVO',
                currentZoneId: calculatedZoneId,
                routeHistory: [
                  {
                    lat: latitude,
                    lng: longitude,
                    timestamp: new Date().toLocaleTimeString().slice(0, 5),
                    hr: 74,
                    spo2: 99,
                  },
                ],
                isUserDevice: true,
              };
              setSelectedSoldierId(userSoldier.id);
              return [userSoldier, ...prev];
            }
          });
        },
        (err) => {
          console.warn('GPS Error:', err.message);
          setIsUserGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      watchGpsIdRef.current = watchId;
    }
  };

  // Push Alert & Siren Dispatcher
  const triggerNewAlert = (alertData: Omit<TacticalAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>) => {
    const newAlert: TacticalAlert = {
      ...alertData,
      id: `alert-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('es-ES'),
      acknowledged: false,
      resolved: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);

    // Play tactical siren or warning chime
    if (newAlert.severity === 'EMERGENCY') {
      tacticalAudio.playEmergencySiren();
    } else {
      tacticalAudio.playWarningBeep();
    }

    // Fire persistent Web Push notification via Service Worker
    if (newAlert.title.includes('CAÍDO') || newAlert.title.includes('IMPACTO')) {
      sendHombreCaidoAlert(newAlert.soldierCallsign, 'Sector Operativo', 165);
    } else if (newAlert.title.includes('GEOFENCE') || newAlert.title.includes('PERÍMETRO')) {
      sendGeofenceAlert(newAlert.soldierCallsign, newAlert.description || 'Zona Restringida', 'ENTRADA');
    } else {
      sendPersistentNotification(`¡ALERTA TÁCTICA: ${newAlert.title}!`, {
        body: `${newAlert.soldierCallsign}: ${newAlert.description}`,
        tag: `c4i-alert-${newAlert.id}`,
      });
    }
  };

  // Trigger test simulated SOS / Anomaly
  const handleTriggerTestEmergency = () => {
    const target = soldiers[Math.floor(Math.random() * soldiers.length)];
    if (!target) return;

    setSoldiers((prev) =>
      prev.map((s) =>
        s.id === target.id
          ? {
              ...s,
              status: 'SOS_EMERGENCIA',
              vitals: {
                ...s.vitals,
                heartRate: 162,
                temperature: 38.8,
                oxygenSaturation: 88,
                stressLevel: 'CRÍTICO',
                fallDetected: true,
                impactGForce: 3.6,
                ecgStatus: 'TAQUICARDIA',
              },
            }
          : s
      )
    );

    triggerNewAlert({
      soldierId: target.id,
      soldierCallsign: target.callsign,
      soldierName: target.name,
      type: 'BOTON_PANICO_SOS',
      severity: 'EMERGENCY',
      title: `¡BOTÓN DE PÁNICO SOS & HOMBRE CAÍDO ACTIVADO!`,
      description: `El operador ${target.callsign} accionó baliza de auxilio táctico en ${target.currentZoneId}. Caída inercial 3.6G registrada.`,
      location: { lat: target.location.lat, lng: target.location.lng },
      vitalsSnapshot: { heartRate: 162, temperature: 38.8, oxygenSaturation: 88 },
    });
  };

  // Manual Spike Trigger from Telemetry Panel
  const handleTriggerVitalsSpike = (soldierId: string, metric: 'bpm' | 'temp' | 'spo2' | 'fall' | 'geofence') => {
    setSoldiers((prev) =>
      prev.map((s) => {
        if (s.id !== soldierId) return s;
        const updated = { ...s };

        if (metric === 'bpm') {
          updated.vitals.heartRate = 155;
          updated.vitals.ecgStatus = 'TAQUICARDIA';
          updated.status = 'CRITICO';
          triggerNewAlert({
            soldierId: s.id,
            soldierCallsign: s.callsign,
            soldierName: s.name,
            type: 'TAQUICARDIA_EXTREMA',
            severity: 'CRITICAL',
            title: 'TAQUICARDIA SEVERA DETECTADA (>150 BPM)',
            description: `Frecuencia cardíaca acelerada a 155 BPM en ${s.callsign}. Riesgo de sobreesfuerzo o estrés agudo.`,
            location: { lat: s.location.lat, lng: s.location.lng },
            vitalsSnapshot: { heartRate: 155, temperature: s.vitals.temperature, oxygenSaturation: s.vitals.oxygenSaturation },
          });
        } else if (metric === 'temp') {
          updated.vitals.temperature = 39.1;
          updated.status = 'EN_ALERTA';
          triggerNewAlert({
            soldierId: s.id,
            soldierCallsign: s.callsign,
            soldierName: s.name,
            type: 'BIOMETRICO_CRITICO',
            severity: 'WARNING',
            title: 'GOLPE DE CALOR / HIPERTERMIA (>39.0°C)',
            description: `Temperatura corporal elevada a 39.1°C en ${s.callsign}. Se requiere hidratación inmediata.`,
            location: { lat: s.location.lat, lng: s.location.lng },
            vitalsSnapshot: { heartRate: s.vitals.heartRate, temperature: 39.1, oxygenSaturation: s.vitals.oxygenSaturation },
          });
        } else if (metric === 'spo2') {
          updated.vitals.oxygenSaturation = 87;
          updated.vitals.ecgStatus = 'HIPOXIA';
          updated.status = 'CRITICO';
          triggerNewAlert({
            soldierId: s.id,
            soldierCallsign: s.callsign,
            soldierName: s.name,
            type: 'HIPOXIA_SEVERA',
            severity: 'CRITICAL',
            title: 'HIPOXIA AGUDA DETECTADA (SpO2 87%)',
            description: `Caída crítica en saturación de oxígeno a 87% en ${s.callsign}. Despachar auxilio médico.`,
            location: { lat: s.location.lat, lng: s.location.lng },
            vitalsSnapshot: { heartRate: s.vitals.heartRate, temperature: s.vitals.temperature, oxygenSaturation: 87 },
          });
        } else if (metric === 'fall') {
          updated.vitals.fallDetected = true;
          updated.vitals.impactGForce = 3.8;
          updated.status = 'SOS_EMERGENCIA';
          triggerNewAlert({
            soldierId: s.id,
            soldierCallsign: s.callsign,
            soldierName: s.name,
            type: 'HOMBRE_CAIDO',
            severity: 'EMERGENCY',
            title: 'HOMBRE CAÍDO & IMPACTO SEVERO (3.8G)',
            description: `Sensor inercial detectó desaceleración violenta e inmovilidad en ${s.callsign}.`,
            location: { lat: s.location.lat, lng: s.location.lng },
            vitalsSnapshot: { heartRate: s.vitals.heartRate, temperature: s.vitals.temperature, oxygenSaturation: s.vitals.oxygenSaturation },
          });
        } else if (metric === 'geofence') {
          updated.location.lat = 9.4215; // Set outside Coveñas base coordinates
          updated.location.lng = -75.6980;
          updated.currentZoneId = 'OUT_OF_BOUNDS';
          // Alert is triggered automatically by useEffect monitoring updated state
        }

        return updated;
      })
    );
  };

  // Operational Dispatch Handlers
  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
    tacticalAudio.playRadioRoger();
  };

  const handleResolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true, acknowledged: true } : a))
    );
  };

  const handleDispatchQRF = (incidentAlert: TacticalAlert) => {
    setConfirmAction({ type: 'QRF', payload: incidentAlert });
  };

  const executeDispatchQRF = (incidentAlert: TacticalAlert) => {
    tacticalAudio.playRadioRoger();
    setMessages((prev) => [
      {
        id: `msg-${Date.now()}`,
        sender: 'CENTRO C4I (MANDO)',
        senderRole: 'Puesto de Mando',
        recipient: 'FUERZA DE REACCIÓN RÁPIDA (QRF)',
        text: `[DESPACHO QRF INMEDIATO] Desplazarse a coordenadas de ${incidentAlert.soldierCallsign}. Incidente: ${incidentAlert.title}`,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        priority: 'FLASH_OPERACIONAL',
        encrypted: true,
      },
      ...prev,
    ]);
  };

  const handleDispatchMedevac = (incidentAlert: TacticalAlert) => {
    tacticalAudio.playRadioRoger();
    setMessages((prev) => [
      {
        id: `msg-${Date.now()}`,
        sender: 'CENTRO C4I (MANDO)',
        senderRole: 'Puesto de Mando',
        recipient: 'UNIDAD MEDEVAC TÁCTICA',
        text: `[MEDEVAC TÁCTICO EN RUTA] Preparar camilla y soporte vital para evacuación aérea de ${incidentAlert.soldierCallsign}. Signos: ${incidentAlert.vitalsSnapshot ? `${incidentAlert.vitalsSnapshot.heartRate} BPM, SpO2 ${incidentAlert.vitalsSnapshot.oxygenSaturation}%` : 'Urgente'}.`,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        priority: 'FLASH_OPERACIONAL',
        encrypted: true,
      },
      ...prev,
    ]);
  };

  const handleSendMessage = (msg: { text: string; recipient: string; priority: 'RUTINA' | 'PRIORITARIO' | 'FLASH_OPERACIONAL' }) => {
    setMessages((prev) => [
      {
        id: `msg-${Date.now()}`,
        sender: 'CENTRO C4I (MANDO)',
        senderRole: 'Puesto de Mando',
        recipient: msg.recipient,
        text: msg.text,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        priority: msg.priority,
        encrypted: true,
      },
      ...prev,
    ]);
  };

  const handleDeployNewSoldier = (newSoldier: Soldier) => {
    setSoldiers((prev) => [newSoldier, ...prev]);
    setSelectedSoldierId(newSoldier.id);
    tacticalAudio.playRadioRoger();
  };

  const handleRotateCryptoKeys = () => {
    setConfirmAction({ type: 'KEY_ROTATION' });
  };

  const executeRotateCryptoKeys = () => {
    setSoldiers((prev) =>
      prev.map((s) => ({
        ...s,
        device: {
          ...s.device,
          encryptionKeyHash: `0x${Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase()}...NEW`,
          lastSync: 'Clave Re-Keying OK',
        },
      }))
    );
    tacticalAudio.playRadioRoger();
  };

  // Compute Base Summary Metrics
  const baseMetrics: TacticalBaseMetrics = {
    totalPersonnel: soldiers.length,
    activePatrols: soldiers.filter((s) => s.status === 'PATRULLAJE' || s.status === 'OPERATIVO').length,
    alertsCritical: alerts.filter((a) => !a.resolved && (a.severity === 'EMERGENCY' || a.severity === 'CRITICAL')).length,
    alertsWarning: alerts.filter((a) => !a.resolved && a.severity === 'WARNING').length,
    perimeterCoverageScore: 94,
    averageHeartRate: Math.round(soldiers.reduce((acc, s) => acc + s.vitals.heartRate, 0) / (soldiers.length || 1)),
    averageSpO2: Math.round(soldiers.reduce((acc, s) => acc + s.vitals.oxygenSaturation, 0) / (soldiers.length || 1)),
    averageResponseTimeSec: 28,
    networkIntegrity: 99.8,
    e2eePacketsSec: 14,
  };

  const unreadAlertsCount = alerts.filter((a) => !a.acknowledged && !a.resolved).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      
      {/* Emergency Blackout Overlay */}
      {isBlackout && (
        <TacticalBlackout onDisableBlackout={() => setIsBlackout(false)} />
      )}

      {/* Tactical Top Bar */}
      <NavbarTactical
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadAlertsCount={unreadAlertsCount}
        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        onOpenSitrep={() => setIsSitrepOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenComms={() => setIsCommsOpen(true)}
        onTriggerTestEmergency={handleTriggerTestEmergency}
        onToggleUserGps={toggleUserGps}
        isUserGpsActive={isUserGpsActive}
        onTriggerBlackout={() => setIsBlackout(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenZoneConfigurator={() => setIsZoneConfiguratorOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1750px] w-full mx-auto p-2 sm:p-4 md:p-5 space-y-4 pb-24 md:pb-6">
        
        {/* VIEW TAB 1: 2D TACTICAL MAP & OPERATOR ROSTER */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Map Canvas (7 cols on large) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
              <TacticalMap
                soldiers={soldiers}
                zones={zones}
                alerts={alerts}
                selectedSoldierId={selectedSoldierId}
                onSelectSoldier={(id) => {
                  setSelectedSoldierId(id);
                  setPlaybackIndex(null);
                }}
                baseCenter={BASE_CENTER}
                playbackIndex={playbackIndex}
                sharedMarkers={sharedMarkers}
                onAddTacticalMarker={handleAddTacticalMarker}
                onResolveTacticalMarker={handleResolveTacticalMarker}
                onCleanOldTacticalMarkers={handleCleanOldTacticalMarkers}
              />
            </div>

            {/* Personnel List / Roster (5 cols on large) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
              <PersonnelList
                soldiers={soldiers}
                zones={zones}
                alerts={alerts}
                selectedSoldierId={selectedSoldierId}
                onSelectSoldier={(id) => {
                  setSelectedSoldierId(id);
                  setPlaybackIndex(null);
                }}
                onOpenTelemetryTab={(id) => {
                  setSelectedSoldierId(id);
                  setPlaybackIndex(null);
                  setActiveTab('telemetry');
                }}
                onTriggerSoldierEmergency={(id) => handleTriggerVitalsSpike(id, 'fall')}
                onAddNewSoldier={() => setIsDeployOpen(true)}
              />
            </div>

          </div>
        )}

        {/* VIEW TAB 2: 3D TERRAIN & GLOBE TOPOGRAPHY */}
        {activeTab === '3dmap' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* 3D Map Viewport (8 cols on large) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-[680px]">
              <Tactical3DMapView
                soldiers={soldiers}
                zones={zones}
                alerts={alerts}
                selectedSoldierId={selectedSoldierId}
                onSelectSoldier={(id) => {
                  setSelectedSoldierId(id);
                  setPlaybackIndex(null);
                }}
                baseCenter={BASE_CENTER}
                sharedMarkers={sharedMarkers}
                patrols={patrols}
                onUpdatePatrols={setPatrols}
              />
            </div>

            {/* Personnel Roster Side Panel */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
              <PersonnelList
                soldiers={soldiers}
                zones={zones}
                alerts={alerts}
                selectedSoldierId={selectedSoldierId}
                onSelectSoldier={(id) => {
                  setSelectedSoldierId(id);
                  setPlaybackIndex(null);
                }}
                onOpenTelemetryTab={(id) => {
                  setSelectedSoldierId(id);
                  setPlaybackIndex(null);
                  setActiveTab('telemetry');
                }}
                onTriggerSoldierEmergency={(id) => handleTriggerVitalsSpike(id, 'fall')}
                onAddNewSoldier={() => setIsDeployOpen(true)}
              />
            </div>

          </div>
        )}

        {/* VIEW TAB 2: HEALTH & WEARABLE TELEMETRY */}
        {activeTab === 'telemetry' && (
          <HealthTelemetryPanel
            soldiers={soldiers}
            selectedSoldierId={selectedSoldierId}
            onSelectSoldier={(id) => {
              setSelectedSoldierId(id);
              setPlaybackIndex(null);
            }}
            onTriggerVitalsSpike={handleTriggerVitalsSpike}
            playbackIndex={playbackIndex}
            onPlaybackIndexChange={setPlaybackIndex}
          />
        )}

        {/* VIEW TAB 3: METRICS & OPERATIONAL PERFORMANCE */}
        {activeTab === 'metrics' && (
          <MetricsDashboardView
            soldiers={soldiers}
            alerts={alerts}
            zones={zones}
            metrics={baseMetrics}
          />
        )}

        {/* VIEW TAB 4: E2EE CLOUD SECURITY & PACKET INSPECTOR */}
        {activeTab === 'e2ee' && (
          <E2EECloudSecurityModal
            packets={packets}
            soldiers={soldiers}
            onTriggerManualKeyRotation={handleRotateCryptoKeys}
          />
        )}

      </main>

      {/* Floating Active Alerts Modal / Drawer */}
      {isAlertsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] p-4 sm:p-6">
            <div className="overflow-y-auto flex-1 pr-1">
              <AlertsAndDispatchPanel
                alerts={alerts}
                soldiers={soldiers}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResolveAlert={handleResolveAlert}
                onDispatchQRF={handleDispatchQRF}
                onDispatchMedevac={handleDispatchMedevac}
                onSelectSoldier={(id) => {
                  setSelectedSoldierId(id);
                  setIsAlertsOpen(false);
                  setActiveTab('map');
                }}
                onClose={() => setIsAlertsOpen(false)}
                isModal={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* AI SITREP Intelligence Modal */}
      <AiTacticalSitrepModal
        isOpen={isSitrepOpen}
        onClose={() => setIsSitrepOpen(false)}
        soldiers={soldiers}
        alerts={alerts}
        zones={zones}
      />

      {/* Tactical Encrypted Comms Drawer */}
      <TacticalCommsDrawer
        isOpen={isCommsOpen}
        onClose={() => setIsCommsOpen(false)}
        messages={messages}
        soldiers={soldiers}
        onSendMessage={handleSendMessage}
      />

      {/* Deploy Operator Modal */}
      <DeployOperatorModal
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
        zones={zones}
        onDeploy={handleDeployNewSoldier}
      />

      {/* Security Zone & Patrol Configurator Modal */}
      <SecurityZoneConfigurator
        isOpen={isZoneConfiguratorOpen}
        onClose={() => setIsZoneConfiguratorOpen(false)}
        zones={zones}
        onUpdateZones={setZones}
        patrols={patrols}
        onUpdatePatrols={setPatrols}
        soldiers={soldiers}
        onSelectZoneOnMap={() => {
          setIsZoneConfiguratorOpen(false);
          setActiveTab('map');
        }}
      />

      {/* Critical Action Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === 'QRF') {
            executeDispatchQRF(confirmAction.payload);
          } else if (confirmAction.type === 'KEY_ROTATION') {
            executeRotateCryptoKeys();
          }
          setConfirmAction(null);
        }}
        title={
          confirmAction?.type === 'QRF'
            ? 'AUTORIZAR DESPACHO INMEDIATO QRF'
            : 'ROTACIÓN COMPLETA DE CLAVES CRIPTOGRÁFICAS'
        }
        description={
          confirmAction?.type === 'QRF'
            ? `¿Confirmar el despacho táctico inmediato de la Fuerza de Reacción Rápida (QRF) en auxilio de ${confirmAction.payload?.soldierCallsign}? La escuadra de combate se desplegará de urgencia con equipamiento blindado al Sector correspondiente.`
            : '¿Confirmar la revocación completa de claves criptográficas y distribución síncrona de nuevos hashes de sesión AES-256 para todos los transpondedores del personal de operaciones?'
        }
        criticalText={
          confirmAction?.type === 'QRF'
            ? 'AUTORIZAR QRF'
            : 'AUTORIZAR ROTACIÓN'
        }
        severity={confirmAction?.type === 'QRF' ? 'danger' : 'warning'}
      />

      {/* Quick Start Onboarding Interactive Tour Overlay */}
      <QuickStartOnboarding
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAlertsOpen={isAlertsOpen}
        setIsAlertsOpen={setIsAlertsOpen}
        unreadAlertsCount={unreadAlertsCount}
      />

      {/* Footer Info */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3 text-center text-xs font-mono-military text-slate-500">
        <div className="max-w-[1750px] mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>AegisBase C4I &bull; Sistema Militar de Telemetría Táctica y Vigilancia Perimetral</span>
          <span className="text-emerald-500/80 font-bold">ENCRIPTACIÓN E2EE ACTIVA (AES-GCM-256)</span>
        </div>
      </footer>

    </div>
  );
}
