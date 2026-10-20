/**
 * Persistent Web Push Notification Service using Service Worker
 * Ensures critical tactical alerts (Man Down, Geofence, Proximity Violations)
 * reach the operator even when the browser tab is in the background or minimized.
 */

export interface PersistentNotificationOptions {
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  vibrate?: number[];
  requireInteraction?: boolean;
  data?: any;
}

/**
 * Request permission for browser Web Push notifications
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones de escritorio.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Check if notification permission is granted
 */
export function isPushPermissionGranted(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Send a persistent notification via Service Worker registration
 */
export async function sendPersistentNotification(
  title: string,
  options: PersistentNotificationOptions
): Promise<boolean> {
  if (!isPushPermissionGranted()) {
    const granted = await requestPushPermission();
    if (!granted) return false;
  }

  const defaultOptions: NotificationOptions & Record<string, any> = {
    body: options.body,
    icon: options.icon || '/pwa-192x192.png',
    badge: options.badge || '/pwa-192x192.png',
    vibrate: options.vibrate || [300, 100, 300, 100, 300, 100, 400],
    tag: options.tag || 'c4i-critical-alert',
    renotify: true,
    requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : true,
    data: options.data || { url: '/' },
  };

  try {
    // Try sending via active Service Worker registration for persistent background delivery
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, defaultOptions);
        return true;
      }
    }
  } catch (err) {
    console.warn('Error al mostrar notificación via Service Worker, utilizando fallback directo:', err);
  }

  // Fallback to standard Notification API if SW is unavailable
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, defaultOptions);
      return true;
    }
  } catch (err) {
    console.error('Error al mostrar notificación directa:', err);
  }

  return false;
}

/**
 * Helper specifically tailored for 'Hombre Caído' (Man Down / Fall Detected) critical alerts
 */
export async function sendHombreCaidoAlert(soldierCallsign: string, sector: string, hr: number): Promise<boolean> {
  return sendPersistentNotification(`🚨 ¡ALERTA CRÍTICA: HOMBRE CAÍDO - ${soldierCallsign}!`, {
    body: `El operador ${soldierCallsign} ha registrado un impacto severo o caída en ${sector}. FC: ${hr} BPM. ¡Acción inmediata requerida!`,
    tag: `man-down-${soldierCallsign}`,
    vibrate: [500, 100, 500, 100, 500, 100, 500],
    requireInteraction: true,
  });
}

/**
 * Helper specifically tailored for 'Geofence Violation' critical alerts
 */
export async function sendGeofenceAlert(soldierCallsign: string, zoneName: string, action: 'ENTRADA' | 'SALIDA'): Promise<boolean> {
  return sendPersistentNotification(`⚠️ ¡VIOLACIÓN DE PERÍMETRO GEOFENCE - ${soldierCallsign}!`, {
    body: `Unidad ${soldierCallsign} ha registrado una ${action} no autorizada en la zona restringida: ${zoneName}.`,
    tag: `geofence-${soldierCallsign}`,
    vibrate: [300, 150, 300, 150, 300],
    requireInteraction: true,
  });
}

/**
 * Helper specifically tailored for 'Proximity Radar' safety distance alerts
 */
export async function sendProximityAlert(soldier1: string, soldier2: string, distanceMeters: number, thresholdMeters: number): Promise<boolean> {
  return sendPersistentNotification(`💥 ¡ALERTA DE PROXIMIDAD CRÍTICA DE UNIDADES!`, {
    body: `Distancia de seguridad violada entre ${soldier1} y ${soldier2}: ${distanceMeters.toFixed(0)}m (Mínimo establecido: ${thresholdMeters}m).`,
    tag: `proximity-${soldier1}-${soldier2}`,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
  });
}
