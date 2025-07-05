# Solución a problemas de CORS en funciones Edge de Supabase

## Descripción del problema

El error "Access to fetch has been blocked by CORS policy" ocurre cuando tu aplicación frontend intenta acceder a las funciones Edge de Supabase desde un origen diferente (por ejemplo, desde `http://localhost:5173` durante el desarrollo local).

## Solución implementada

Se han realizado las siguientes modificaciones para solucionar el problema:

1. **Cabeceras CORS adecuadas**: Se han configurado las cabeceras CORS en ambas funciones.

2. **Manejo explícito de solicitudes OPTIONS**: Se ha mejorado el manejo de solicitudes preflight OPTIONS asegurando que respondan con un estado 200 y las cabeceras CORS adecuadas.

3. **Parámetros de despliegue actualizados**: Se ha actualizado el script de despliegue para incluir el parámetro `--cors` con los dominios permitidos.

## Pasos para desplegar

1. **Despliegue con CORS configurado**:
   
   Ejecuta el script actualizado:
   ```bash
   cd supabase/functions
   deploy.bat
   ```

   Este script desplegará las funciones con CORS configurado para permitir solicitudes desde:
   - `http://localhost:5173` (desarrollo local)
   - `https://econecta.app` (producción)

2. **Verificación de la configuración de CORS**:

   Después del despliegue, puedes verificar la configuración de CORS ejecutando:
   ```bash
   supabase functions list-cors
   ```

## Pruebas locales

Para probar las funciones localmente antes de desplegarlas:

1. **Ejecuta el servidor de desarrollo de Supabase**:
   ```bash
   supabase start
   supabase functions serve --cors http://localhost:5173,https://econecta.app
   ```

2. **Realiza una solicitud de prueba**:
   - Desde el navegador: `http://localhost:54321/functions/v1/verify-email-service`
   - O usando curl:
   ```bash
   curl -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" http://localhost:54321/functions/v1/verify-email-service
   ```

## Depuración de problemas de CORS

Si sigues experimentando problemas de CORS después del despliegue:

1. **Verifica las políticas de CORS en Supabase**:
   ```bash
   supabase functions list-cors
   ```

2. **Actualiza la política CORS para una función específica**:
   ```bash
   supabase functions update-cors verify-email-service --allowed-origins http://localhost:5173,https://econecta.app
   ```

3. **Comprueba los logs de las funciones**:
   ```bash
   supabase functions logs verify-email-service
   ```

4. **Prueba con una herramienta como Postman**: Esto te ayudará a determinar si el problema es específico del navegador.

## Notas adicionales

- En un entorno de producción, es mejor limitar los orígenes permitidos en lugar de usar el comodín `*`.
- Si necesitas permitir más dominios, añádelos a la lista separados por comas en el parámetro `--cors`.
- Si el frontend y las funciones Edge están en el mismo dominio, no deberías tener problemas de CORS.
