import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useMessages } from '../context/MessagesContext';

const Chat = () => {
  const { otherUserId } = useParams<{ otherUserId: string }>(); // ID del reciclador
  const { user } = useUser(); // El residente autenticado
  const { messages, fetchConversation, sendMessage } = useMessages();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id && otherUserId) {
      setLoading(true);
      setError(null);
      fetchConversation(user.id, otherUserId)
        .catch(() => setError('Error al cargar mensajes'))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line
  }, [user, otherUserId]);

  const handleSend = async () => {
    if (user?.id && otherUserId && input.trim()) {
      try {
        await sendMessage(user.id, otherUserId, input);
        setInput('');
      } catch {
        setError('No se pudo enviar el mensaje');
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
              className={`mb-2 flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <span
                className={`px-3 py-1 rounded ${
                  msg.senderId === user.id ? 'bg-green-200' : 'bg-gray-200'
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