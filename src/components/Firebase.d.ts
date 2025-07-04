// Declaración de tipos para Firebase.js
import { FirebaseApp } from 'firebase/app';
import { Analytics } from 'firebase/analytics';
import { Messaging } from 'firebase/messaging';

declare const app: FirebaseApp;
declare const analytics: Analytics;
declare const messaging: Messaging;

export { app, analytics, messaging };

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Solicita permiso para enviar notificaciones y devuelve el token del dispositivo
 * @returns {Promise<string|null>} Token del dispositivo o null si no se obtuvo permiso
 */
export function requestNotificationPermission(): Promise<string | null>;

/**
 * Configura las notificaciones en primer plano
 */
export function setupForegroundNotifications(): void;

/**
 * Envía una notificación a un usuario específico mediante su token
 * @param {string} userToken - Token del dispositivo
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Record<string, string>} data - Datos adicionales para la notificación
 * @returns {Promise<NotificationResult>} Resultado de la operación
 */
export function sendNotificationToUser(
  userToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<NotificationResult>;

/**
 * Envía una notificación a un tema (grupo de usuarios)
 * @param {string} topic - Nombre del tema
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Record<string, string>} data - Datos adicionales para la notificación
 * @returns {Promise<NotificationResult>} Resultado de la operación
 */
export function sendNotificationToTopic(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<NotificationResult>;
