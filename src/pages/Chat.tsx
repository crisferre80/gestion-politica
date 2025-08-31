import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useMessages } from '../context/MessagesContext';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import { enviarMensajeSeguro } from '../lib/chatUtils';

const Chat = () => {
  // El parámetro debe ser el user_id (UUID de Supabase Auth)
  const { otherUserId } = useParams<{ otherUserId: string }>(); // Debe ser user_id
  const { user } = useUser(); // El Dirigente autenticado
  const { messages, fetchConversation } = useMessages();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
      // Marcar como leídos los mensajes recibidos por el usuario actual
      (async () => {
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('receiver_id', myUserId)
          .eq('sender_id', otherUserId)
          .eq('read', false);
      })();
    }
    // eslint-disable-next-line
  }, [myUserId, otherUserId]);

  const handleSend = async () => {
    console.log('[Chat] handleSend', { myUserId, otherUserId, input });
    if (myUserId && otherUserId && input.trim()) {
      try {
        console.log('[Chat] Enviando mensaje de', myUserId, 'a', otherUserId, 'contenido:', input);
        await enviarMensajeSeguro(myUserId, otherUserId, input);
        console.log('[Chat] Mensaje enviado correctamente');
        setInput('');
        await fetchConversation(myUserId, otherUserId);
        // Notificación para el receptor
        try {
          await createNotification({
            user_id: otherUserId,
            title: 'Nuevo mensaje',
            content: `Has recibido un nuevo mensaje de ${user?.name || 'un Dirigente'}.`,
            type: 'new_message',
            related_id: myUserId,
            user_name: user?.name,
            user_email: user?.email
          });
        } catch {
          setError('El mensaje fue enviado, pero no se pudo notificar al usuario destinatario.');
        }
      } catch (err: unknown) {
        console.error('[Chat] Error al enviar mensaje', err);
        setError(
          (err instanceof Error ? err.message : 'No se pudo enviar el mensaje') +
          `\n[Debug] myUserId: ${myUserId} | otherUserId: ${otherUserId}`
        );
      }
    } else {
      console.warn('[Chat] handleSend: IDs o input inválidos', { myUserId, otherUserId, input });
      setError(
        `IDs o input inválidos.\n[Debug] myUserId: ${myUserId} | otherUserId: ${otherUserId}`
      );
    }
  };

  if (!user) return <div>Debes iniciar sesión para ver el chat.</div>;
  if (!otherUserId) return <div>No se encontró el usuario para chatear.</div>;

  return (
    <div className="max-w-3xl mx-auto p-0 md:p-6 bg-white rounded-2xl shadow-xl flex flex-col md:flex-row gap-0 md:gap-6 border border-gray-200">
      {/* Botón para volver al panel del Dirigente */}
      <div className="w-full flex items-center mb-2">
        <button
          className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md font-semibold shadow-sm border border-blue-300 mt-2 mb-2 ml-2"
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1);
            } else {
              navigate('/dashboard-resident');
            }
          }}
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Volver al Panel
        </button>
      </div>
      {/* Conversación principal */}
      <div className="flex flex-col w-full md:w-2/3 border-b md:border-b-0 md:border-r border-gray-200 px-4 py-6 bg-gradient-to-br from-blue-50 to-blue-50 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-400 bg-white flex items-center justify-center">
            {otherProfile.avatar_url ? (
              <img src={otherProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl bg-gray-100">{otherProfile.name?.[0] || '?'}</span>
            )}
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-blue-800 mb-0 leading-tight">{otherProfile.name || 'Usuario'}</h2>
            <span className="text-xs text-gray-500">Chat privado</span>
          </div>
        </div>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <div className="flex-1 flex flex-col justify-end">
          {loading ? (
            <div className="h-64 flex items-center justify-center border p-2 mb-4 bg-gray-50 rounded-lg">Cargando...</div>
          ) : (
            <div className="h-96 md:h-[32rem] overflow-y-auto border p-3 mb-4 bg-white rounded-lg shadow-inner flex flex-col gap-2 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
              {messages.map(msg => {
                const isMe = msg.senderId === myUserId;
                const profile = isMe ? myProfile : otherProfile;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMe ? 'justify-end flex-row-reverse' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 border-2 border-blue-600">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg bg-gray-100">{profile.name?.[0] || '?'}</span>
                      )}
                    </div>
                    <div className={`flex flex-col items-${isMe ? 'end' : 'start'} max-w-[70%]`}>
                      <div className={`flex items-center gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}> 
                        <span className="text-xs text-gray-500 font-semibold">{profile.name || (isMe ? 'Tú' : 'Usuario')}</span>
<span className="text-[10px] text-gray-400">{
  msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
}</span>
                      </div>
                      <span
                        className={`px-4 py-2 rounded-2xl block break-words shadow text-sm ${
                          isMe
                            ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
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
        {/* Input abajo de la conversación */}
        <form
          className="flex items-center gap-2 mt-2 bg-white rounded-xl shadow px-3 py-2 border border-gray-200"
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            className="flex-1 border-none outline-none bg-transparent px-2 py-2 text-gray-700 placeholder-gray-400 text-base"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={loading}
            autoComplete="off"
            maxLength={500}
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold shadow disabled:opacity-50 transition"
            disabled={loading || !input.trim()}
          >
            Enviar
          </button>
        </form>
      </div>
      {/* Panel derecho para info extra o usuarios (opcional, placeholder) */}
      {/* <div className="flex flex-col w-1/3 justify-end"> ... </div> */}
    </div>
  );
};

export default Chat;