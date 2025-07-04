// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Inicializar la aplicación Firebase
firebase.initializeApp({
  apiKey: "AIzaSyDOJYAby32IrARJaCkJ1o7hGmU7HAGtdL4",
  authDomain: "econecta2-346d4.firebaseapp.com",
  projectId: "econecta2-346d4",
  storageBucket: "econecta2-346d4.firebasestorage.app",
  messagingSenderId: "15435452481",
  appId: "1:15435452481:web:b2e9ae56fd38724a0436c0",
  measurementId: "G-R1E2PWNYLV"
  // Nota: No se incluye la clave VAPID aquí, ya que el service worker no la necesita directamente
});

// Recuperar una instancia de Firebase Messaging
const messaging = firebase.messaging();

/**
 * Maneja mensajes recibidos cuando la aplicación está en segundo plano
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Recibido mensaje en segundo plano:', payload);
  
  // Personaliza la notificación aquí
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    // Puedes agregar más opciones como:
    // image: '/path/to/image.jpg',
    // actions: [{action: 'open_url', title: 'Ver más'}],
    data: payload.data,
    vibrate: [200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Maneja el clic en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Clic en notificación:', event);
  
  event.notification.close();
  
  // Esta es la URL a la que se redirigirá cuando se haga clic en la notificación
  // Puedes personalizarla según los datos recibidos en la notificación
  const urlToOpen = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then((windowClients) => {
      // Si ya hay una ventana abierta, enfócala
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Si no hay ninguna ventana abierta, abre una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
