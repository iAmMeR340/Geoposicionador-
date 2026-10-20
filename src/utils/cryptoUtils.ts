import { E2EEPacket, Soldier } from '../types';

/**
 * Utility to generate real-looking cryptographic hashes, E2EE AES-GCM simulation,
 * and authenticated packet structures.
 */

// Simple hex generator for IV and cipher blocks
function generateHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < bytes; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function createE2EEPacket(soldier: Soldier): E2EEPacket {
  const iv = generateHex(12); // 96-bit IV for AES-GCM
  const authTag = generateHex(16); // 128-bit Authentication Tag
  const rawPayload = JSON.stringify({
    uid: soldier.id,
    callsign: soldier.callsign,
    pos: [soldier.location.lat, soldier.location.lng, soldier.location.altitude],
    hr: soldier.vitals.heartRate,
    temp: soldier.vitals.temperature,
    spo2: soldier.vitals.oxygenSaturation,
    stress: soldier.vitals.stressLevel,
    impact: soldier.vitals.impactGForce,
    ts: Date.now(),
  });

  // Simulated AES-256-GCM ciphertext representation
  const cipherChunks = [];
  for (let i = 0; i < 4; i++) {
    cipherChunks.push(generateHex(8));
  }
  const encryptedPayload = `AES256GCM_${cipherChunks.join('-')}_$${generateHex(4)}`;

  return {
    packetId: `PKT-${generateHex(4)}-${Date.now().toString().slice(-4)}`,
    sourceDevice: soldier.device.model,
    soldierCallsign: soldier.callsign,
    encryptedPayload,
    iv: `0x${iv}`,
    authTag: `0x${authTag}`,
    decryptedData: {
      lat: soldier.location.lat,
      lng: soldier.location.lng,
      hr: soldier.vitals.heartRate,
      temp: soldier.vitals.temperature,
      spo2: soldier.vitals.oxygenSaturation,
    },
    latencyMs: Math.floor(18 + Math.random() * 24),
    cipherSuite: 'TLS 1.3 / AES-256-GCM / ECDH P-384 / SHA-384',
    timestamp: new Date().toLocaleTimeString(),
    status: 'VERIFICADO_VALIDO',
  };
}

// Convert degrees to Military Grid Reference (approximate MGRS/UTM string display)
export function latLngToMGRS(lat: number, lng: number): string {
  const latBand = lat >= 0 ? 'N' : 'S';
  const easting = Math.floor((lng + 180) * 1000) % 100000;
  const northing = Math.floor((Math.abs(lat) * 111000)) % 100000;
  return `18N TK ${String(easting).padStart(5, '0')} ${String(northing).padStart(5, '0')}`;
}
