import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useMessages } from '../context/MessagesContext';
import { supabase } from '../lib/supabase';

// Función utilitaria para validar IDs y enviar mensaje
async function enviarMensajeSeguro(senderId: string, receiverId: string, content: string) {
  // Validar sender
  const { data: sender, error: senderError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', senderId)
    .single();
  if (senderError || !sender) {
    throw new Error('El remitente no existe en la tabla de perfiles.');
  }
  // Validar receiver
  const { data: receiver, error: receiverError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', receiverId)
    .single();
  if (receiverError || !receiver) {
    throw new Error('El destinatario no existe en la tabla de perfiles.');
  }
  // Insertar mensaje
  const { error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: senderId,
        receiver_id: receiverId,
        content: content,
        is_read: false,
        // No agregues 'timestamp', la tabla solo tiene 'created_at'
      },
    ]);
  if (error) throw error;
}

const Chat = () => {
  // El parámetro debe ser el user_id (UUID de Supabase Auth)
  const { otherUserId } = useParams<{ otherUserId: string }>(); // Debe ser user_id
  const { user } = useUser(); // El residente autenticado
  const { messages, fetchConversation } = useMessages();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El user_id real es user.id (UUID de Supabase Auth)
  const myUserId = user?.id;

  // --- Componente auxiliar para obtener nombre y avatar de un usuario ---
  type UserProfile = { name: string; avatar_url: string | null };
  const useUserProfile = (userId: string | undefined) => {
    const [profile, setProfile] = useState<UserProfile>({ name: '', avatar_url: null });
    useEffect(() => {
      if (!userId) return;
      let isMounted = true;
      supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('user_id', userId)
        .single()
        .then(({ data }) => {
          if (isMounted && data) setProfile({ name: data.name, avatar_url: data.avatar_url });
        });
      return () => { isMounted = false; };
    }, [userId]);
    return profile;
  };

  const myProfile = useUserProfile(myUserId);
  const otherProfile = useUserProfile(otherUserId);

  useEffect(() => {
    if (myUserId && otherUserId) {
      setLoading(true);
      setError(null);
      fetchConversation(myUserId, otherUserId)
        .catch(() => setError('Error al cargar mensajes'))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line
  }, [myUserId, otherUserId]);

  const handleSend = async () => {
    if (myUserId && otherUserId && input.trim()) {
      // Log para depuración de IDs
      console.log('myUserId:', myUserId, 'typeof:', typeof myUserId);
      console.log('otherUserId:', otherUserId, 'typeof:', typeof otherUserId);
      try {
        await enviarMensajeSeguro(myUserId, otherUserId, input);
        setInput('');
        // Recargar la conversación para mostrar el mensaje enviado
        await fetchConversation(myUserId, otherUserId);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('No se pudo enviar el mensaje');
        }
      }
    }
  };

  if (!user) return <div>Debes iniciar sesión para ver el chat.</div>;
  if (!otherUserId) return <div>No se encontró el usuario para chatear.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 bg-white rounded shadow flex flex-row gap-4">
      {/* Conversación a la izquierda */}
      <div className="flex flex-col w-2/3 border-r pr-4">
        <h2 className="text-xl font-bold mb-4">Chat con reciclador</h2>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        {loading ? (
          <div className="h-64 flex items-center justify-center border p-2 mb-4 bg-gray-50">Cargando...</div>
        ) : (
          <div className="h-96 overflow-y-auto border p-2 mb-4 bg-gray-50">
            {messages.map(msg => {
              const isMe = msg.senderId === myUserId;
              const profile = isMe ? myProfile : otherProfile;
              return (
                <div
                  key={msg.id}
                  className={`mb-2 flex items-start gap-2 ${isMe ? '' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 border-2 border-green-600">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg bg-gray-100">{profile.name?.[0] || '?'}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-gray-500 font-semibold">{profile.name || (isMe ? 'Tú' : 'Usuario')}</span>
                      <span className="text-[10px] text-gray-400">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded block max-w-xs break-words ${
                        isMe ? 'bg-green-200 text-gray-900' : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      {msg.content}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Input a la derecha */}
      <div className="flex flex-col w-1/3 justify-end">
        <div className="flex flex-col h-full justify-end">
          <input
            className="border rounded-l px-2 py-1 mb-2"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={loading}
          />
          <button
            type="button"
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;