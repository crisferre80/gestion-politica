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
    // Buscar mensajes entre reciclador y residente (usando user_id, no id interno)
    const { data: messages } = await supabase
      .from('messages')
      .select('content, sent_at, sender_id, receiver_id, read')
      .or(`and(sender_id.eq.${residentUserId},receiver_id.eq.${recyclerUserId}),and(sender_id.eq.${recyclerUserId},receiver_id.eq.${residentUserId})`)
      .order('sent_at', { ascending: false })
      .limit(20);
    let lastMessage = undefined;
    let unreadCount = 0;
    if (messages && messages.length > 0) {
      lastMessage = {
        content: messages[0].content,
        created_at: messages[0].sent_at,
      };
      // Mensajes no leídos enviados por el residente al reciclador (usando user_id)
      unreadCount = messages.filter(
        m => m.sender_id === residentUserId && m.receiver_id === recyclerUserId && m.read === false
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

/**
 * Envía un mensaje robusto entre dos usuarios usando sus user_id (UUID de Auth),
 * buscando los id reales de profiles y creando el perfil si no existe.
 * Ahora con hasta 5 reintentos para evitar error 23503 por consistencia eventual o RLS.
 */
export async function enviarMensajeSeguro(senderUserId: string, receiverUserId: string, content: string) {
  // Asegura que ambos perfiles existen
  await ensureUserProfile({ id: senderUserId });
  await ensureUserProfile({ id: receiverUserId });

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
