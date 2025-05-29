import { supabase } from './supabase';

export async function createNotification({
  user_id,
  title,
  content,
  type,
  related_id
}: {
  user_id: string;
  title: string;
  content: string;
  type: string;
  related_id?: string;
}) {
  await supabase.from('notifications').insert([
    {
      user_id,
      title,
      content,
      type,
      related_id: related_id || null,
      read: false,
      created_at: new Date().toISOString(),
    },
  ]);
}
