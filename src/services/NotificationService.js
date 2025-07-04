// Este archivo debe ir en tu backend, no en el frontend
// Para fines educativos, lo incluyo aquí pero debe ser trasladado a tu servidor

const admin = require('firebase-admin');

// Importar las credenciales desde la configuración
// En un entorno real de Node.js, deberías importar así:
// const { FIREBASE_ADMIN_CREDENTIALS } = require('../config/firebase-config');
// Como estamos mezclando frontend y backend, definimos las credenciales aquí:
const FIREBASE_ADMIN_CREDENTIALS = {
  "type": "service_account",
  "project_id": "econecta2-346d4",
  "private_key": "BEb3IDkDXLZ-Zg_BpVzBa9ZrT9Hu9BkskiTxwkLxI0TybSBYZiZiYs-9DARAJfIUvn9hEP_FvMzVfT8RWbqNxI0",
  "client_email": "firebase-adminsdk-econecta@econecta2-346d4.iam.gserviceaccount.com"
};

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_ADMIN_CREDENTIALS),
    databaseURL: "https://econecta2-346d4.firebaseio.com"
  });
}

/**
 * Envía una notificación a un dispositivo específico utilizando su token FCM
 * @param {string} token - Token del dispositivo
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Object} data - Datos adicionales para la notificación
 */
const sendToDevice = async (token, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data,
      token,
    };

    const response = await admin.messaging().send(message);
    console.log('Notificación enviada correctamente:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error al enviar la notificación:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envía una notificación a múltiples dispositivos
 * @param {Array<string>} tokens - Lista de tokens de dispositivos
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Object} data - Datos adicionales para la notificación
 */
const sendToMultipleDevices = async (tokens, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens, // Máximo 500 tokens por solicitud
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`${response.successCount} notificaciones enviadas correctamente`);
    
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: tokens[idx],
            error: resp.error,
          });
        }
      });
      console.error('Lista de tokens fallidos:', failedTokens);
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error al enviar notificaciones múltiples:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envía una notificación a un tema (topic)
 * @param {string} topic - Nombre del tema
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Object} data - Datos adicionales para la notificación
 */
const sendToTopic = async (topic, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data,
      topic,
    };

    const response = await admin.messaging().send(message);
    console.log('Notificación enviada al tema correctamente:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`Error al enviar la notificación al tema ${topic}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Suscribe un dispositivo a un tema (topic)
 * @param {string|Array<string>} tokens - Token o lista de tokens a suscribir
 * @param {string} topic - Nombre del tema
 */
const subscribeToTopic = async (tokens, topic) => {
  try {
    const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
    const response = await admin.messaging().subscribeToTopic(tokensArray, topic);
    console.log(`Suscripción al tema ${topic} completada:`, response);
    return { success: true, results: response.results };
  } catch (error) {
    console.error(`Error al suscribir al tema ${topic}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Desuscribe un dispositivo de un tema (topic)
 * @param {string|Array<string>} tokens - Token o lista de tokens a desuscribir
 * @param {string} topic - Nombre del tema
 */
const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
    const response = await admin.messaging().unsubscribeFromTopic(tokensArray, topic);
    console.log(`Desuscripción del tema ${topic} completada:`, response);
    return { success: true, results: response.results };
  } catch (error) {
    console.error(`Error al desuscribir del tema ${topic}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendToDevice,
  sendToMultipleDevices,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic
};
