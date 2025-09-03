import { supabase, ensureUserProfile } from './supabase';

export async function createNotification({
  user_id,
  title,
  content,
  type,
  related_id,
  user_email,
  user_name
}: {
  user_id: string;
  title?: string;
  content?: string;
  type?: string;
  related_id?: string;
  user_email?: string;
  user_name?: string;
}) {
  // Asegura que el perfil existe antes de insertar la notificación
  await ensureUserProfile({ id: user_id, email: user_email ?? '', name: user_name ?? '' });

  // Construir el payload base y permitir reintentos si la tabla no tiene
  // algunas columnas esperadas (PostgREST devuelve PGRST204 indicando la columna faltante)
  const basePayload: Record<string, unknown> = {
    user_id,
  // La tabla de tu ejemplo tiene columna `message` en lugar de `content`/`title`.
  // Mapear content/title a `message` para compatibilidad con el esquema.
  message: content || title || null,
  type,
    related_id: related_id || null,
    read: false,
  };

  // Intentar insertar, y si PostgREST indica columna faltante, eliminarla y reintentar
  const maxAttempts = 6;
  let attempt = 0;
  // Construir payload inicial filtrando claves con valor null/undefined
  const payload = Object.fromEntries(
    Object.entries(basePayload).filter(([, v]) => v !== null && v !== undefined)
  ) as Record<string, unknown>;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const { error } = await supabase.from('notifications').insert([payload]);
      if (!error) {
        console.log(`[notifications] Notificación insertada correctamente (intento ${attempt}) para user_id=${user_id}`);
        return;
      }

      // Si hay error y es PGRST204, intentar identificar la columna faltante
      console.error('Error insertando notificación:', error);
      if (error.code === 'PGRST204' && typeof error.message === 'string') {
        const m = /Could not find the '(.+?)' column/.exec(error.message);
        if (m && m[1]) {
          const missing = m[1];
          console.warn(`[notifications] Columna faltante detectada: ${missing}. Eliminando del payload e intentando de nuevo (intento ${attempt}).`);
          // El nombre de la columna suele coincidir con la clave del payload
          if (missing in payload) {
            // Eliminar la clave detectada como inexistente. Hacemos un cast seguro para permitir delete.
            const p = payload as Record<string, unknown>;
            delete p[missing];
            // continuar el loop para reintentar
            continue;
          } else {
            // Si la columna faltante no está en el payload, no podemos remediarlo automáticamente
            throw error;
          }
        }
      }

      // Para cualquier otro error, propagar
      throw error;
    } catch (err) {
      // Si excedimos intentos, re-lanzar
      if (attempt >= maxAttempts) {
        console.error('[notifications] No se pudo insertar la notificación tras varios intentos:', err);
        throw err;
      }
      // Si el catch corresponde a haber eliminado un campo y hay más intentos, el loop continúa
      // Añadimos una espera corta para evitar ráfagas (no bloqueante serio)
      await new Promise(res => setTimeout(res, 120));
    }
  }

  // Si llegamos aquí, algo falló
  throw new Error('No se pudo insertar la notificación (max attempts alcanzado)');
}
