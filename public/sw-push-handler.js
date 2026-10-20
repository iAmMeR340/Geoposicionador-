// AegisBase C4I Service Worker Push & Notification Click Handler

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus open tab or open a new window when notification is clicked
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Handle push events sent via server or background sync
self.addEventListener('push', (event) => {
  let data = {
    title: '¡ALERTA CRÍTICA C4I!',
    body: 'Se ha detectado una emergencia táctica en el sector de operaciones.',
    tag: 'c4i-alert',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Alerta táctica de seguridad.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [300, 100, 300, 100, 300, 100, 400],
    tag: data.tag || 'c4i-persistent-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});
