# NOTA INTERNA: Sincronización de recicladores en línea en DashboardResident

Este proyecto utiliza una lógica robusta para asegurar que el listado de recicladores en línea en el panel del residente se actualice en tiempo real, sin necesidad de recargar la página ni reiniciar sesión.

## Lógica implementada

- **Suscripción realtime a la tabla `profiles`**: Cada vez que ocurre un evento relevante (INSERT, UPDATE, DELETE) sobre perfiles con rol `recycler`, se fuerza un fetch inmediato de todos los recicladores en línea.
- **Polling adicional**: Se ejecuta un polling cada 2 segundos como respaldo, para máxima inmediatez y tolerancia a fallos de eventos realtime.
- **Persistencia en sessionStorage**: El array de recicladores en línea se guarda en sessionStorage para mantener el estado entre recargas.

## ¿Por qué es importante?

Esta combinación garantiza que:
- Si un reciclador entra o sale de sesión, el cambio se refleja casi instantáneamente en el panel del residente.
- Si alguna vez se pierde la actualización inmediata (por error de código o cambios accidentales), restaurar este bloque de suscripción + polling es la forma más robusta de recuperar el comportamiento esperado.

## Fragmento clave (ejemplo):

```tsx
useEffect(() => {
  // ...
  // IMPORTANTE: Esta suscripción + polling garantiza que los recicladores en línea se actualicen en tiempo real en el panel del residente.
  // Si alguna vez se pierde la actualización inmediata de recicladores, restaurar este bloque con polling + fetch tras cada evento realtime.
  // Esta es la forma más robusta para reflejar cambios de sesión de recicladores sin recargar la página.
  let isMounted = true;
  const fetchOnlineRecyclers = async () => { /* ... */ };
  fetchOnlineRecyclers();
  const channel = supabase.channel('recyclers-profiles')
    .on('postgres_changes', { /* ... */ }, fetchOnlineRecyclers)
    .subscribe();
  const interval = setInterval(fetchOnlineRecyclers, 2000);
  return () => { isMounted = false; supabase.removeChannel(channel); clearInterval(interval); };
}, []);
```

## Archivo creado automáticamente por GitHub Copilot

No eliminar este archivo sin antes asegurar que la lógica de actualización inmediata de recicladores está documentada y funcional.
