import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { enviarMensajeSeguro } from '../lib/chatUtils';

export type Message = {
    createdAt: string;
    id: string;
    senderId: string; // UUID de Supabase Auth (user_id)
    receiverId: string; // UUID de Supabase Auth (user_id)
    content: string;
    timestamp: Date;
};

type MessagesContextType = {
    messages: Message[];
    fetchConversation: (userId1: string, userId2: string) => Promise<void>;
    sendMessage: (senderId: string, receiverId: string, content: string) => Promise<void>;
};

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider = ({ children }: { children: ReactNode }) => {
    const [messages, setMessages] = useState<Message[]>([]);

    // Cargar mensajes entre dos usuarios (usando user_id de Auth)
    const fetchConversation = async (userId1: string, userId2: string) => {
        // Buscar los id reales de profiles
        const { data: profile1 } = await supabase
            .from('profiles')
            .select('id, user_id')
            .eq('user_id', userId1)
            .single();
        const { data: profile2 } = await supabase
            .from('profiles')
            .select('id, user_id')
            .eq('user_id', userId2)
            .single();
        if (!profile1 || !profile2) {
            setMessages([]);
            return;
        }
        const id1 = profile1.id;
        const id2 = profile2.id;
        // Map de id interno a user_id
        const idToUserId: Record<string, string> = {
            [id1]: profile1.user_id,
            [id2]: profile2.user_id
        };
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(
                `and(sender_id.eq.${id1},receiver_id.eq.${id2}),and(sender_id.eq.${id2},receiver_id.eq.${id1})`
            )
            .order('sent_at', { ascending: true });
        if (error) {
            console.error('Error fetching messages:', error);
            setMessages([]);
            return;
        }
        // Adaptar los datos a tu tipo Message, usando user_id para el frontend
        type SupabaseMessage = {
            id: string | number;
            sender_id: string;
            receiver_id: string;
            content: string;
            sent_at: string;
            read?: boolean;
            read_at?: string;
        };
        setMessages(
            (data ?? []).map((msg: SupabaseMessage) => ({
                id: msg.id.toString(),
                senderId: idToUserId[msg.sender_id] || msg.sender_id,
                receiverId: idToUserId[msg.receiver_id] || msg.receiver_id,
                content: msg.content,
                timestamp: new Date(msg.sent_at),
                createdAt: msg.sent_at
                // No incluir read ni readAt en el objeto Message
            }))
        );
    };

    // Enviar mensaje y recargar la conversación
    const sendMessage = async (senderUserId: string, receiverUserId: string, content: string) => {
        // Usa la función centralizada para robustez
        try {
            await enviarMensajeSeguro(senderUserId, receiverUserId, content);
            await fetchConversation(senderUserId, receiverUserId);
        } catch (err) {
            console.error('[sendMessage] Error al enviar mensaje:', err);
        }
    };

    return (
        <MessagesContext.Provider value={{ messages, fetchConversation, sendMessage }}>
            {children}
        </MessagesContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMessages = () => {
    const context = useContext(MessagesContext);
    if (!context) {
        throw new Error('useMessages must be used within a MessagesProvider');
    }
    return context;
};