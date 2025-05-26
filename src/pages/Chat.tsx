import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';

type Message = {
  id: string;
  sender_id: string;
  content: string;
};

type MessagesContextType = {
  messages: Message[];
  fetchMessages: (otherUserId: string) => void;
  sendMessage: (otherUserId: string, content: string) => Promise<void>;
};

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchMessages = (otherUserId: string) => {
    // Replace with real API call
    setMessages([
      { id: '1', sender_id: otherUserId, content: 'Hola!' },
      { id: '2', sender_id: 'me', content: '¡Hola! ¿Cómo estás?' },
    ]);
  };

  const sendMessage = async (otherUserId: string, content: string) => {
    // Replace with real API call
    const newMsg: Message = {
      id: Math.random().toString(),
      sender_id: 'me',
      content: `[To: ${otherUserId}] ${content}`,
    };
    setMessages(prev => [...prev, newMsg]);
  };

  return (
    <MessagesContext.Provider value={{ messages, fetchMessages, sendMessage }}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};

const Chat = () => {
  const { otherUserId } = useParams<{ otherUserId: string }>(); // ID del reciclador
  const { user } = useUser(); // El residente autenticado
  const { messages, fetchMessages, sendMessage } = useMessages();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (otherUserId) fetchMessages(otherUserId);
    // eslint-disable-next-line
  }, [otherUserId]);

  const handleSend = async () => {
    if (otherUserId && input.trim()) {
      await sendMessage(otherUserId, input);
      setInput('');
    }
  };

  if (!user) return <div>Debes iniciar sesión para ver el chat.</div>;

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Chat con reciclador</h2>
      <div className="h-64 overflow-y-auto border p-2 mb-4 bg-gray-50">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`mb-2 flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <span
              className={`px-3 py-1 rounded ${
                msg.sender_id === user.id ? 'bg-green-200' : 'bg-gray-200'
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
      </div>
      <div className="flex">
        <input
          className="flex-grow border rounded-l px-2 py-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
        />
        <button
          className="bg-green-500 text-white px-4 rounded-r"
          onClick={handleSend}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default Chat;