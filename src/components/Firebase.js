import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { FIREBASE_CONFIG } from "../config/firebase-config";
import { urlBase64ToUint8Array, formatVapidKey } from "../utils/vapid-helpers";

const firebaseConfig = FIREBASE_CONFIG.client;

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


export const messaging = getMessaging(app);

// Función para solicitar permiso y obtener el token del dispositivo
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // El usuario ha dado permiso para recibir notificaciones
      try {
        // Asegurarse de que la clave VAPID está en el formato correcto
        const vapidKey = "BEb3IDkDXLZ-Zg_BpVzBa9ZrT9Hu9BkskiTxwkLxI0TybSBYZiZiYs-9DARAJfIUvn9hEP_FvMzVfT8RWbqNxI0";
        const formattedVapidKey = formatVapidKey(vapidKey);
        
        console.log("Solicitando token con clave VAPID:", formattedVapidKey);
        const currentToken = await getToken(messaging, { 
          vapidKey: formattedVapidKey
        });
        
        if (currentToken) {
          console.log('Token de dispositivo:', currentToken);
          // Aquí puedes enviar este token a tu backend para almacenarlo
          return currentToken;
        } else {
          console.log('No se pudo obtener el token del dispositivo.');
          return null;
        }
      } catch (error) {
        console.error('Error al obtener token con clave VAPID:', error);
        return null;
      }
    } else {
      console.log('Permiso de notificaciones denegado.');
      return null;
    }
  } catch (error) {
    console.error('Error al solicitar permiso para notificaciones:', error);
    return null;
  }
};

// Función para manejar mensajes cuando la app está en primer plano
export const setupForegroundNotifications = () => {
  onMessage(messaging, (payload) => {
    console.log('Mensaje recibido en primer plano:', payload);
    
    // Crear una notificación aunque la app esté abierta
    if (payload.notification) {
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico', // Ruta a tu ícono de notificación
        data: payload.data,
      };
      
      // Mostrar notificación usando la API de Notificaciones
      new Notification(notificationTitle, notificationOptions);
    }
  });
};

// Función para enviar notificación a un token específico (requiere backend)
export const sendNotificationToUser = async (userToken, title, body, data = {}) => {
  // Esta función debe ser implementada en el backend
  // Aquí solo se muestra cómo preparar los datos para enviar al backend
  const notificationData = {
    token: userToken,
    notification: {
      title,
      body,
    },
    data,
  };
  
  try {
    // Esta llamada se debe hacer desde el backend por seguridad
    // Aquí deberías hacer una solicitud a tu API
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    throw error;
  }
};

// Función para enviar notificación a un tema (grupo de usuarios)
export const sendNotificationToTopic = async (topic, title, body, data = {}) => {
  // Esta función debe ser implementada en el backend
  const notificationData = {
    topic,
    notification: {
      title,
      body,
    },
    data,
  };
  
  try {
    // Esta llamada se debe hacer desde el backend por seguridad
    const response = await fetch('/api/send-topic-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error al enviar notificación a tema:', error);
    throw error;
  }
};

// Exportar la app y analytics también
export { app, analytics };