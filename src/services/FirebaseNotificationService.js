// Este es un archivo de servicio temporal para pruebas
// Para producción, estas funciones deben estar en el backend por seguridad

import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '../components/Firebase';
import { FIREBASE_CONFIG } from '../config/firebase-config';

const messaging = getMessaging(app);

// Obtener token del dispositivo con la clave VAPID
export const getDeviceToken = async () => {
  try {
    const currentToken = await getToken(messaging, { 
      vapidKey: FIREBASE_CONFIG.vapidKey
    });
    
    if (currentToken) {
      console.log('Token del dispositivo actual:', currentToken);
      return currentToken;
    } else {
      console.log('No se pudo obtener el token del dispositivo.');
      return null;
    }
  } catch (error) {
    console.error('Error al obtener token del dispositivo:', error);
    return null;
  }
};

// Para pruebas: simulación de envío de notificación 
// Esta función NO envía realmente notificaciones, solo simula el comportamiento
export const sendNotificationForTesting = async (token, title, body, data = {}) => {
  try {
    console.log('Simulando envío de notificación:');
    console.log('Token:', token);
    console.log('Título:', title);
    console.log('Cuerpo:', body);
    console.log('Datos:', data);
    
    // En una implementación real, aquí se haría una petición al backend
    // Por ahora, simular una respuesta exitosa
    return { 
      success: true, 
      message: 'Notificación simulada enviada correctamente. En una implementación real, esto sería procesado por el backend.' 
    };
  } catch (error) {
    console.error('Error en simulación de envío:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Para activar manualmente una notificación local (solo para demostración)
export const showLocalNotification = (title, body, icon = '/favicon.ico') => {
  if (!('Notification' in window)) {
    console.error('Este navegador no soporta notificaciones de escritorio');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon
    });
    
    notification.onclick = () => {
      console.log('Notificación clickeada');
      notification.close();
      window.focus();
    };
    
    return true;
  } else {
    console.warn('Permiso de notificaciones no concedido');
    return false;
  }
};

// Para pruebas: simular envío a un tema
export const sendTopicNotificationForTesting = async (topic, title, body, data = {}) => {
  try {
    console.log('Simulando envío de notificación a tema:');
    console.log('Tema:', topic);
    console.log('Título:', title);
    console.log('Cuerpo:', body);
    console.log('Datos:', data);
    
    // En una implementación real, aquí se haría una petición al backend
    return { 
      success: true, 
      message: `Notificación simulada enviada al tema "${topic}". En una implementación real, esto sería procesado por el backend.` 
    };
  } catch (error) {
    console.error('Error en simulación de envío a tema:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};
