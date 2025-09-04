import { supabase, ensureUserProfile } from './supabase';

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
 * Obtiene el último mensaje y el número de mensajes no leídos para cada Dirigente con el que el reciclador tiene conversación.
 * @param recyclerUserId string (user_id del reciclador)
 * @param dirigenteUserIds string[] (user_id de los Dirigentes)
 */
export async function getChatPreviews(recyclerUserId: string, dirigenteUserIds: string[]) {
  // Buscar los id internos de profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id, name, avatar_url')
    .in('user_id', dirigenteUserIds);
  if (!profiles) return [];

  // Map de user_id a profile
  const profileMap: Record<string, { id: string; name: string; avatar_url?: string }> = {};
  for (const p of profiles) {
    profileMap[p.user_id] = { id: p.id, name: p.name, avatar_url: p.avatar_url };
  }

  // Para cada Dirigente, obtener el último mensaje y los no leídos
  const previews: ChatPreview[] = [];
  for (const dirigenteUserId of dirigenteUserIds) {
    const dirigenteProfile = profileMap[dirigenteUserId];
    if (!dirigenteProfile) continue;
    // Buscar mensajes entre reciclador y Dirigente (usando user_id, no id interno)
    const { data: messages } = await supabase
      .from('messages')
      .select('content, sent_at, sender_id, receiver_id, read')
      .or(`and(sender_id.eq.${dirigenteUserId},receiver_id.eq.${recyclerUserId}),and(sender_id.eq.${recyclerUserId},receiver_id.eq.${dirigenteUserId})`)
      .order('sent_at', { ascending: false })
      .limit(20);
    let lastMessage = undefined;
    let unreadCount = 0;
    if (messages && messages.length > 0) {
      lastMessage = {
        content: messages[0].content,
        created_at: messages[0].sent_at,
      };
      // Mensajes no leídos enviados por el Dirigente al reciclador (usando user_id)
      unreadCount = messages.filter(
        m => m.sender_id === dirigenteUserId && m.receiver_id === recyclerUserId && m.read === false
      ).length;
    }
    previews.push({
      userId: dirigenteUserId,
      name: dirigenteProfile.name,
      avatar_url: dirigenteProfile.avatar_url,
      lastMessage,
      unreadCount,
    });
  }
  return previews;
}

/**
 * Envía un mensaje robusto entre dos usuarios usando sus user_id (UUID de Auth),
 * buscando los id reales de profiles y creando el perfil si no existe.
 * Ahora con hasta 5 reintentos para evitar error 23503 por consistencia eventual o RLS.
 */
export async function enviarMensajeSeguro(senderUserId: string, receiverUserId: string, content: string) {
  // Asegura que ambos perfiles existen
  await ensureUserProfile({ id: senderUserId, email: '', name: '' });
  await ensureUserProfile({ id: receiverUserId, email: '', name: '' });

  // Reintenta hasta 5 veces obtener los perfiles internos (por si la inserción es lenta o RLS)
  async function getProfileWithRetry(userId: string, retries = 5, delay = 250): Promise<{ id: string; user_id: string } | null> {
    for (let i = 0; i < retries; i++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', userId)
        .single();
      console.log(`[enviarMensajeSeguro] Intento ${i+1}/${retries} para user_id=${userId}:`, data, error);
      if (data && !error) return data;
      await new Promise(res => setTimeout(res, delay));
    }
    return null;
  }

  const senderProfile = await getProfileWithRetry(senderUserId);
  const receiverProfile = await getProfileWithRetry(receiverUserId);

  if (!senderProfile) {
    throw new Error('El remitente no tiene perfil válido (ni tras reintentos). user_id=' + senderUserId);
  }
  if (!receiverProfile) {
    throw new Error('El destinatario no tiene perfil válido (ni tras reintentos). user_id=' + receiverUserId);
  }

  // Insertar mensaje usando user_id (igual a auth.uid())
  const insertObj = {
    sender_id: senderProfile.user_id, // user_id, no id interno
    receiver_id: receiverProfile.user_id, // user_id, no id interno
    content: content,
    sent_at: new Date().toISOString()
  };
  console.log('[enviarMensajeSeguro] insertObj', insertObj);
  const user = await supabase.auth.getUser();
  console.log('[enviarMensajeSeguro] usuario autenticado', user);
  const { error } = await supabase.from('messages').insert([insertObj]);
  if (error) {
    console.error('[enviarMensajeSeguro] Error al insertar mensaje:', error);
    throw error;
  }
}

/**
 * Obtiene todos los mensajes entre dos usuarios (por user_id, no id interno).
 */
export async function fetchMessages(userId1: string, userId2: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
