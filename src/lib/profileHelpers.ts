import { supabase } from './supabase';

/**
 * Resuelve la fila de profiles para un user_id y devuelve la fila completa.
 * Retorna null si no existe o en caso de error.
 */
export async function resolveProfileRow(userId: string) {
  if (!userId) return null;
  try {
    const { data: row, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('resolveProfileRow supabase error:', error);
      return null;
    }
    return row || null;
  } catch (e) {
    console.error('resolveProfileRow exception:', e);
    return null;
  }
}

/**
 * Actualiza el perfil del usuario buscando primero la fila y actualizando por la clave disponible.
 * Esto evita asumir que existe una columna `id`.
 */
export async function updateProfileByUserId(userId: string, updateObj: Record<string, any>) {
  if (!userId) return { error: 'missing_user_id' };
  try {
    const row = await resolveProfileRow(userId);
    if (!row) return { error: 'profile_not_found' };
    const key = 'id' in row ? 'id' : 'user_id';
    const value = row[key as keyof typeof row];
    const { error } = await supabase.from('profiles').update(updateObj).eq(key, value as any);
    return { error: error || null };
  } catch (e) {
    console.error('updateProfileByUserId error:', e);
    return { error: e };
  }
}
