// Este es un ejemplo de cómo podrías implementar un endpoint API para enviar notificaciones
// Debe ser implementado en tu servidor backend (Node.js/Express)

const express = require('express');
const router = express.Router();
const notificationService = require('../services/NotificationService');

// Middleware para autenticar las peticiones (implementar según tu sistema de autenticación)
const authenticateAdmin = (req, res, next) => {
  // Implementar autenticación aquí
  // Si la autenticación falla:
  // return res.status(401).json({ success: false, error: 'No autorizado' });
  
  // Si la autenticación es exitosa:
  next();
};

// Endpoint para enviar una notificación a un dispositivo específico
router.post('/send-notification', authenticateAdmin, async (req, res) => {
  try {
    const { token, notification, data } = req.body;
    
    if (!token || !notification || !notification.title || !notification.body) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere token, título y cuerpo de notificación'
      });
    }
    
    const result = await notificationService.sendToDevice(
      token,
      notification.title,
      notification.body,
      data || {}
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error en endpoint de notificación:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para enviar notificaciones a múltiples dispositivos
router.post('/send-multiple-notifications', authenticateAdmin, async (req, res) => {
  try {
    const { tokens, notification, data } = req.body;
    
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0 || !notification) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de tokens y datos de notificación'
      });
    }
    
    const result = await notificationService.sendToMultipleDevices(
      tokens,
      notification.title,
      notification.body,
      data || {}
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error en endpoint de notificaciones múltiples:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para enviar notificación a un tema
router.post('/send-topic-notification', authenticateAdmin, async (req, res) => {
  try {
    const { topic, notification, data } = req.body;
    
    if (!topic || !notification) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere topic y datos de notificación'
      });
    }
    
    const result = await notificationService.sendToTopic(
      topic,
      notification.title,
      notification.body,
      data || {}
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error en endpoint de notificación a tema:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para suscribir dispositivos a un tema
router.post('/subscribe-to-topic', authenticateAdmin, async (req, res) => {
  try {
    const { tokens, topic } = req.body;
    
    if (!tokens || !topic) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren tokens y topic'
      });
    }
    
    const result = await notificationService.subscribeToTopic(tokens, topic);
    return res.json(result);
  } catch (error) {
    console.error('Error en endpoint de suscripción a tema:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para desuscribir dispositivos de un tema
router.post('/unsubscribe-from-topic', authenticateAdmin, async (req, res) => {
  try {
    const { tokens, topic } = req.body;
    
    if (!tokens || !topic) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren tokens y topic'
      });
    }
    
    const result = await notificationService.unsubscribeFromTopic(tokens, topic);
    return res.json(result);
  } catch (error) {
    console.error('Error en endpoint de desuscripción a tema:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
