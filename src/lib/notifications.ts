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
  title: string;
  content: string;
  type: string;
  related_id?: string;
  user_email?: string;
  user_name?: string;
}) {
  // Asegura que el perfil existe antes de insertar la notificación
  await ensureUserProfile({ id: user_id, email: user_email, name: user_name });
  const { error } = await supabase.from('notifications').insert([
    {
      user_id,
      title,
      content,
      type,
      related_id: related_id || null,
      read: false,
      closed: false
      // No enviamos id ni created_at, la base los autogenera
    },
  ]);
  if (error) {
    console.error('Error insertando notificación:', error);
    throw error;
  }
}
