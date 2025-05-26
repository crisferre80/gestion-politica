import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast';

interface ChatWithRecyclerProps {
  otherUserId: string;      // user_id del destinatario (sea reciclador o residente)
  otherUserName: string;
  open: boolean;
  onClose: () => void;
}

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

const ChatWithRecycler: React.FC<ChatWithRecyclerProps> = ({
  otherUserId,
  otherUserName,
  open,
  onClose,
}) => {
  const { user } = useUser();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar mensajes previos
  useEffect(() => {
    if (!open || !user?.id) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });
      if (!error && data) setMessages(data);
    };
    fetchMessages();
  }, [open, user, otherUserId]);

  // Suscripción en tiempo real
  useEffect(() => {
    if (!open || !user?.id) return;
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(sender_id=eq.${user.id},receiver_id=eq.${user.id})`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === user.id)
          ) {
            setMessages((prev) => [...prev, msg]);
            if (msg.receiver_id === user.id && msg.sender_id !== user.id) {
              toast.success('¡Nuevo mensaje recibido!');
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, user, otherUserId]);

  // Scroll automático al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!message.trim() || !user?.id || !otherUserId) return;
    const { data, error } = await supabase.from('messages').insert([
      {
        sender_id: user.id,         // tu user_id
        receiver_id: otherUserId,   // user_id del destinatario
        content: message,
        is_read: false,
      },
    ]).select().single();

    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setMessage('');
      toast.success('Mensaje enviado');
    } else {
      console.error(error);
      toast.error('No se pudo enviar el mensaje');
    }
  };

  console.log('sender_id:', user?.id, 'receiver_id:', otherUserId);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
        >
          ✕
        </button>
        <h3 className="text-lg font-bold mb-2 text-green-700">
          Chat con {otherUserName}
        </h3>
        <div className="h-60 overflow-y-auto border rounded p-2 mb-2 bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-center">No hay mensajes aún.</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-2 ${
                  msg.sender_id === user?.id ? 'text-right' : 'text-left'
                }`}
              >
                <span className="block text-xs text-gray-400">
                  {msg.sender_id === user?.id ? 'Tú' : otherUserName} -{' '}
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
                <span
                  className={`inline-block ${
                    msg.sender_id === user?.id
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-200 text-gray-800'
                  } rounded px-2 py-1 text-sm mt-1`}
                >
                  {msg.content}
                </span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
          />
          <button
            onClick={handleSendMessage}
            className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWithRecycler;

// Ejemplo de uso (debe colocarse en el componente padre donde 'resident' esté definido):
// <ChatWithRecycler
//   otherUserId={resident.user_id} // user_id del residente
//   otherUserName={resident.profiles.name}
//   open={chatOpen}
//   onClose={() => setChatOpen(false)}
// />
