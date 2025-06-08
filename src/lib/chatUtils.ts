import { supabase } from './supabase';

export interface ChatPreview {
  userId: string;
  name: string;
  avatar_url?: string;
  lastMessage?: {
    content: string;
    created_at: string;
  };
  unreadCount: number;
}

/**
 * Obtiene el último mensaje y el número de mensajes no leídos para cada residente con el que el reciclador tiene conversación.
 * @param recyclerUserId string (user_id del reciclador)
 * @param residentUserIds string[] (user_id de los residentes)
 */
export async function getChatPreviews(recyclerUserId: string, residentUserIds: string[]) {
  // Buscar los id internos de profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id, name, avatar_url')
    .in('user_id', residentUserIds);
  if (!profiles) return [];

  // Map de user_id a profile
  const profileMap: Record<string, { id: string; name: string; avatar_url?: string }> = {};
  for (const p of profiles) {
    profileMap[p.user_id] = { id: p.id, name: p.name, avatar_url: p.avatar_url };
  }

  // Para cada residente, obtener el último mensaje y los no leídos
  const previews: ChatPreview[] = [];
  for (const residentUserId of residentUserIds) {
    const residentProfile = profileMap[residentUserId];
    if (!residentProfile) continue;
    // Buscar mensajes entre reciclador y residente
    const { data: messages } = await supabase
      .from('messages')
      .select('content, sent_at, sender_id, receiver_id, read')
      .or(`and(sender_id.eq.${residentProfile.id},receiver_id.eq.${recyclerUserId}),and(sender_id.eq.${recyclerUserId},receiver_id.eq.${residentProfile.id})`)
      .order('sent_at', { ascending: false })
      .limit(20); // Trae los últimos 20
    let lastMessage = undefined;
    let unreadCount = 0;
    if (messages && messages.length > 0) {
      lastMessage = {
        content: messages[0].content,
        created_at: messages[0].sent_at,
      };
      // Mensajes no leídos enviados por el residente al reciclador
      unreadCount = messages.filter(
        m => m.sender_id === residentProfile.id && m.receiver_id === recyclerUserId && m.read === false
      ).length;
    }
    previews.push({
      userId: residentUserId,
      name: residentProfile.name,
      avatar_url: residentProfile.avatar_url,
      lastMessage,
      unreadCount,
    });
  }
  return previews;
}
