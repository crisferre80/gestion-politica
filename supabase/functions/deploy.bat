@echo off
echo Desplegando funciones de Supabase con MailerLite...

echo.
echo Desplegando función verify-email-service...
supabase functions deploy verify-email-service --no-verify-jwt --cors http://localhost:5173,https://econecta.app

echo.
echo Desplegando función send-email...
supabase functions deploy send-email --no-verify-jwt --cors http://localhost:5173,https://econecta.app

echo.
echo Despliegue completado.
echo Nota: Se ha configurado CORS para aceptar solicitudes de:
echo - http://localhost:5173 (desarrollo local)
echo - https://econecta.app (producción)
pause
