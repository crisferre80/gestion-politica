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
        timestamp: new Date().toISOString(),
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
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Chat con reciclador</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {loading ? (
        <div className="h-64 flex items-center justify-center border p-2 mb-4 bg-gray-50">Cargando...</div>
      ) : (
        <div className="h-64 overflow-y-auto border p-2 mb-4 bg-gray-50">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`mb-2 flex ${msg.senderId === myUserId ? 'justify-end' : 'justify-start'}`}
            >
              <span
                className={`px-3 py-1 rounded ${
                  msg.senderId === myUserId ? 'bg-green-200' : 'bg-gray-200'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex">
        <input
          className="flex-grow border rounded-l px-2 py-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          disabled={loading}
        />
        <button
          type="button"
          className="bg-green-500 text-white px-4 rounded-r disabled:opacity-50"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default Chat;