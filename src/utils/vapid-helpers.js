/**
 * Utilidades para trabajar con claves VAPID y Web Push
 */

/**
 * Convierte una clave VAPID de formato string a Uint8Array para usar con la Web Push API
 * @param {string} base64String - Clave VAPID en formato base64
 * @returns {Uint8Array} - Clave en formato Uint8Array
 */
export const urlBase64ToUint8Array = (base64String) => {
  // Reemplazar caracteres no compatibles con URL
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Verifica si la clave VAPID proporcionada está en un formato válido
 * @param {string} vapidKey - Clave VAPID a verificar
 * @returns {boolean} - true si la clave tiene un formato válido
 */
export const isValidVapidKey = (vapidKey) => {
  try {
    // Comprobar formato básico
    if (!vapidKey || typeof vapidKey !== 'string') {
      return false;
    }
    
    // Una clave VAPID debe tener cierta longitud (normalmente 87+ caracteres)
    if (vapidKey.length < 80) {
      return false;
    }
    
    // Intentar convertirla a Uint8Array - si falla, la clave no es válida
    urlBase64ToUint8Array(vapidKey);
    return true;
  } catch (error) {
    console.error('Error al validar clave VAPID:', error);
    return false;
  }
};

/**
 * Convierte una clave VAPID a formato JWT si es necesario
 * @param {string} vapidKey - Clave VAPID en formato base64
 * @returns {string} - Clave VAPID en formato correcto
 */
export const formatVapidKey = (vapidKey) => {
  // Si la clave ya está en formato JWT, devolverla tal cual
  if (vapidKey.includes('.')) {
    return vapidKey;
  }
  
  // Si la clave no tiene el formato esperado para base64url, intentar arreglarlo
  return vapidKey
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export default {
  urlBase64ToUint8Array,
  isValidVapidKey,
  formatVapidKey
};
