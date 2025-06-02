import { supabase } from './supabase';

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}_${Date.now()}.${fileExt}`;

  // Subir a Supabase Storage (sin subcarpeta)
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  // Obtener URL pública
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  // Fix: asegurar que la URL tenga /public/ en la ruta
  const publicUrl = data.publicUrl.replace('/object/avatars/', '/object/public/avatars/');
  return publicUrl || null;
}

export async function updateProfileAvatar(userId: string, avatarUrl: string) {
  const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', userId);
  if (error) throw error;
}
