# Implementación de MailerLite para envío de correos en Econecta

## Descripción

Este documento describe la implementación del servicio de correo electrónico utilizando MailerLite en la aplicación Econecta. Esta integración permite enviar correos transaccionales de notificación a los usuarios mediante la API de MailerLite.

## Configuración

### Funciones implementadas

1. **verify-email-service**: Verifica la conexión con la API de MailerLite.
2. **send-email**: Envía correos electrónicos mediante MailerLite.

### API Key de MailerLite

La API Key de MailerLite ya está configurada directamente en las funciones:

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiMjJmODExOTQ3MTBjMWUyMTQzYjdmNjVlMGY5ODljZDJjN2M0MDUxNzNhNzM0NzIxZDgzYzMwYmFkMWE4YjNhMDViMWFhZWQ4ZDg0OGJhOTciLCJpYXQiOjE3NTE2NTY5MjkuNTQ2ODA3LCJuYmYiOjE3NTE2NTY5MjkuNTQ2ODA5LCJleHAiOjQ5MDczMzA1MjkuNTQyNzI1LCJzdWIiOiIxNjU1NjM4Iiwic2NvcGVzIjpbXX0.aQdZJGLdDe_A7g4fFcwyJ-IAvCLNThx1pPy6il4GbTzHo27t6T9ywUqrNSmhdb9wzLGPulW__6mu1ciPuATWgR3u4EN8ekC6TY1xcAh4ow_4ARxRdnlGe0JhMkHjyCbatZAqEUoCuXkEiF4eyjJzp1XX5_NbLayoHUwV0vqtGgqOXnTS_FIdi5pGFza2I-qVYl7LZyT61P-yNKtbGn2mCYdqOA_rPDNPpMTD0krejRgFpoUU_ilTus50jL2vZaL9_rVJx9A0f3_SnqfmXvmgFfQn91WuYqXOYJPmaV5x4MZU6X8Juz91eISPoZj6TjkdrkCgtNxf74oc9rQqskqE0EjBcux-tzu0LPRXo0NGFxZ4st86vhTBN9vctgsyFlPE9V3xKfodd7qzZmhUAnC3hvlSTGS81T2v5-AXR_dtbadvSoeGRRzuOIzV8JFzDWiRKEYwAb9zhOI1oipatKoAQjRcWAp6Vpme7DtdzHwMOz_nYMrEq7egkjIyZlhkoSqvN_LAHzErgC2AYKTTLWLTzdwtEqPLbQtgQoXb6L0b_uKomaOEyc5jWYDR6KH9myL83v8N0CbQ7p_SwnzhftolJeTBhDomPq2VJTWZm7Sc9nDSGTWCVQW4oRaYVPBNhdokr8w5kenOdF3vtHlbltBl52AIhoXQJSahKvCp8AHp8J4
```

## Despliegue

Para desplegar las funciones en Supabase, ejecuta el script `deploy.bat` en la carpeta `supabase/functions`:

```bash
cd supabase/functions
deploy.bat
```

## Uso del cliente desde el frontend

El cliente de email (`emailClient.ts`) ya está configurado para usar estas funciones. No se requieren cambios adicionales en el frontend.

## Formato de los correos electrónicos

Los correos electrónicos enviados con MailerLite incluyen:

- Cabecera con el logo de Econecta
- Título y contenido personalizable
- Botón de acción opcional (con URL)
- Pie de página con información de la empresa y el año actual

## Configuración de CORS

Ambas funciones están configuradas con cabeceras CORS para permitir solicitudes desde cualquier origen. Esto soluciona los problemas de CORS que estaban ocurriendo previamente.

## Solución de problemas

Si experimentas errores al enviar correos electrónicos:

1. Verifica la conectividad con la API de MailerLite usando la función `verify-email-service`.
2. Revisa los logs de las funciones de Supabase.
3. Asegúrate de que todos los campos requeridos estén presentes en las solicitudes.

## Endpoints de la API

### Verificación del servicio

```http
POST https://mfnvzijeanxvmolrprzj.supabase.co/functions/v1/verify-email-service
```

### Envío de correos electrónicos

```http
POST https://mfnvzijeanxvmolrprzj.supabase.co/functions/v1/send-email
Content-Type: application/json

{
  "to": "destinatario@ejemplo.com",
  "subject": "Asunto del correo",
  "recipientName": "Nombre del destinatario",
  "title": "Título del correo",
  "content": "Contenido del correo",
  "buttonText": "Texto del botón (opcional)",
  "buttonUrl": "URL del botón (opcional)"
}
```

## Notas importantes

1. El servicio está configurado para enviar desde `notificaciones@econecta.app` como remitente.
2. Para envío masivo, utiliza la función `sendBulkEmailNotifications` del cliente de email.
3. Todas las respuestas de error devuelven un código de estado 200 para evitar problemas con CORS.
