export type StressLevel = 'BAJO' | 'MODERADO' | 'ELEVADO' | 'CRÍTICO';

export type SoldierStatus = 'OPERATIVO' | 'PATRULLAJE' | 'EN_ALERTA' | 'CRITICO' | 'SOS_EMERGENCIA' | 'MEDEVAC';

export type ZoneRiskLevel = 'SEGURO' | 'VIGILANCIA_MEDIA' | 'ALTO_RIESGO' | 'ZONA_CRITICA_RESTRINGIDA';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

export type AlertType =
  | 'BIOMETRICO_CRITICO'
  | 'ZONA_ALTO_RIESGO'
  | 'HOMBRE_CAIDO'
  | 'BOTON_PANICO_SOS'
  | 'BATERIA_BAJA'
  | 'PERDIDA_SENAL'
  | 'TAQUICARDIA_EXTREMA'
  | 'HIPOXIA_SEVERA'
  | 'SALIDA_GEOFENCE';

export interface SoldierVitals {
  heartRate: number; // BPM
  temperature: number; // °C
  oxygenSaturation: number; // SpO2 %
  fatigueLevel: number; // 0-100%
  stressLevel: StressLevel;
  steps: number;
  fallDetected: boolean;
  impactGForce: number; // G
  ecgStatus: 'NORMAL' | 'ARRITMIA' | 'TAQUICARDIA' | 'BRADICARDIA' | 'HIPOXIA';
}

export interface WearableDeviceInfo {
  model: string;
  batteryLevel: number; // %
  signalStrength: number; // RSSI dBm
  connectionType: 'ENLACE SATELITAL' | 'RED MALLA TÁCTICA' | 'E2EE LORA-MIL';
  encryptionStatus: 'AES-GCM-256 (ACTIVO)' | 'RE-KEYING' | 'ALERTA';
  lastSync: string;
  encryptionKeyHash: string;
  firmwareVersion: string;
}

export interface SoldierLocation {
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  heading: number; // Degrees 0-360
  accuracy: number; // Meters
  lastUpdate: string;
  isRealGps?: boolean;
}

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  timestamp: string;
  hr: number;
  spo2: number;
  altitude?: number;
}

export interface Soldier {
  id: string;
  callsign: string;
  name: string;
  rank: 'Capitán' | 'Teniente' | 'Sargento Primero' | 'Sargento Segundo' | 'Cabo Primero' | 'Soldado Profesional';
  squad: 'Escuadra Alfa (Vanguardia)' | 'Escuadra Cóndor (Reconocimiento)' | 'Escuadra Centinela (Perímetro)' | 'Unidad MEDEVAC Táctica';
  role: 'Comandante de Pelotón' | 'Líder de Patrulla' | 'Tirador Designado' | 'Médico de Combate' | 'Operador C4I & Drones' | 'Centinela Perimetral' | 'Especialista EOD';
  avatar: string;
  location: SoldierLocation;
  vitals: SoldierVitals;
  device: WearableDeviceInfo;
  status: SoldierStatus;
  currentZoneId: string;
  routeHistory: BreadcrumbPoint[];
  isUserDevice?: boolean;
}

export interface TacticalZone {
  id: string;
  name: string;
  code: string;
  riskLevel: ZoneRiskLevel;
  category?: 'HQ' | 'PATRULLA' | 'RIESGO';
  color: string;
  fillOpacity: number;
  coordinates: [number, number][];
  center: [number, number];
  description: string;
  protocol: string;
  dispersalRadiusMeters?: number;
}

export interface TacticalAlert {
  id: string;
  soldierId: string;
  soldierCallsign: string;
  soldierName: string;
  timestamp: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  acknowledged: boolean;
  resolved: boolean;
  location: { lat: number; lng: number };
  vitalsSnapshot?: {
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
  };
}

export interface E2EEPacket {
  packetId: string;
  sourceDevice: string;
  soldierCallsign: string;
  encryptedPayload: string;
  iv: string;
  authTag: string;
  decryptedData: {
    lat: number;
    lng: number;
    hr: number;
    temp: number;
    spo2: number;
  };
  latencyMs: number;
  cipherSuite: string;
  timestamp: string;
  status: 'VERIFICADO_VALIDO' | 'INTEGRIDAD_OK';
}

export interface TacticalMessage {
  id: string;
  sender: string;
  senderRole: string;
  recipient: string;
  text: string;
  timestamp: string;
  priority: 'RUTINA' | 'PRIORITARIO' | 'FLASH_OPERACIONAL';
  encrypted: boolean;
}

export interface TacticalBaseMetrics {
  totalPersonnel: number;
  activePatrols: number;
  alertsCritical: number;
  alertsWarning: number;
  perimeterCoverageScore: number; // 0-100%
  averageHeartRate: number;
  averageSpO2: number;
  averageResponseTimeSec: number;
  networkIntegrity: number; // %
  e2eePacketsSec: number;
}

export interface TacticalMarker {
  id: string;
  type: 'threat' | 'obstacle';
  title: string;
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'resolved';
}

export type PatrolStatus = 'EN_CURSO' | 'PROGRAMADA' | 'COMPLETADA' | 'PAUSADA';

export interface TacticalPatrol {
  id: string;
  code: string;
  name: string;
  squad: string;
  leaderId: string;
  leaderCallsign: string;
  zoneId: string;
  zoneName: string;
  objective: string;
  status: PatrolStatus;
  startTime: string;
  estimatedEndTime?: string;
  assignedSoldierIds: string[];
  routeWaypoints: [number, number][];
  createdAt: string;
}
