// ADVERTENCIA: Este archivo se ha migrado a emailClient.ts
// Se mantiene para compatibilidad con código existente

import {
  EmailNotificationOptions,
  sendEmailNotification as clientSendEmail,
  sendBulkEmailNotifications as clientSendBulkEmails,
  verifyEmailService as clientVerifyEmail
} from './emailClient';

// Re-exportar tipos e interfaces
export type { EmailNotificationOptions };

/**
 * Envía un correo electrónico de notificación usando una API
 * @deprecated Use emailClient.ts instead
 */
export const sendEmailNotification = async (options: EmailNotificationOptions): Promise<boolean> => {
  // Redireccionar al nuevo cliente de email
  return await clientSendEmail(options);
};

/**
 * Envía múltiples correos electrónicos a una lista de destinatarios
 * Utiliza el nombre del destinatario para personalizar cada correo
 */
export const sendBulkEmailNotifications = async (
  recipients: Array<{email: string; name?: string}>,
  options: Omit<EmailNotificationOptions, 'to' | 'recipientName'>
): Promise<{successful: number; failed: number}> => {
  // Redireccionar al nuevo cliente de email
  return await clientSendBulkEmails(recipients, options);
};

/**
 * Verifica si el servicio de correo está configurado correctamente
 */
export const verifyEmailService = async (): Promise<boolean> => {
  // Redireccionar al nuevo cliente de email
  return await clientVerifyEmail();
};
