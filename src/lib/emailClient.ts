// Cliente para envío de correos a través de una API
import { supabase } from './supabase';

export interface EmailNotificationOptions {
  to: string | string[];
  subject: string;
  recipientName?: string;
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
}

/**
 * Envía un correo electrónico utilizando una función de API
 */
export const sendEmailNotification = async (options: EmailNotificationOptions): Promise<boolean> => {
  try {
    // Llamada a la API de emails (puede ser una función de Supabase, API Gateway, etc.)
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: options
    });
    
    if (error) {
      console.error('Error al enviar correo a través de API:', error);
      return false;
    }
    
    console.log('Correo enviado correctamente:', data);
    return true;
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return false;
  }
};

/**
 * Envía múltiples correos electrónicos a una lista de destinatarios
 * Utiliza el nombre del destinatario para personalizar cada correo
 */
export const sendBulkEmailNotifications = async (
  recipients: Array<{email: string; name?: string}>,
  options: Omit<EmailNotificationOptions, 'to' | 'recipientName'>
): Promise<{successful: number; failed: number}> => {
  let successful = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const emailSent = await sendEmailNotification({
        ...options,
        to: recipient.email,
        recipientName: recipient.name
      });
      
      if (emailSent) {
        successful++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Error al enviar correo a ${recipient.email}:`, error);
      failed++;
    }
  }

  return { successful, failed };
};

/**
 * Verifica si el servicio de correo está configurado correctamente
 */
export const verifyEmailService = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('verify-email-service');
    if (error) {
      console.error('Error al verificar servicio de correo:', error);
      return false;
    }
    return data?.available === true;
  } catch (error) {
    console.error('Error en la verificación del servicio de correo:', error);
    return false;
  }
};
