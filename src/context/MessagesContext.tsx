import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Message = {
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

    // Cargar mensajes entre dos usuarios
    const fetchConversation = async (userId1: string, userId2: string) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(
                `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
            )
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            setMessages([]);
            return;
        }

        // Adaptar los datos a tu tipo Message
        type SupabaseMessage = {
            id: string | number;
            sender_id: string; // UUID de Supabase Auth
            receiver_id: string; // UUID de Supabase Auth
            content: string;
            created_at: string;
        };

        setMessages(
            (data ?? []).map((msg: SupabaseMessage) => ({
                id: msg.id.toString(),
                senderId: msg.sender_id, // UUID
                receiverId: msg.receiver_id, // UUID
                content: msg.content,
                timestamp: new Date(msg.created_at),
            }))
        );
    };

    // Enviar mensaje y recargar la conversación
    const sendMessage = async (senderId: string, receiverId: string, content: string) => {
        // Validar sender
        const { data: sender, error: senderError } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', senderId)
            .single();
        if (senderError || !sender) {
            console.error('El remitente no existe en la tabla de perfiles.');
            return;
        }
        // Validar receiver
        const { data: receiver, error: receiverError } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', receiverId)
            .single();
        if (receiverError || !receiver) {
            console.error('El destinatario no existe en la tabla de perfiles.');
            return;
        }
        // Insertar mensaje
        const { error } = await supabase.from('messages').insert([
            {
                sender_id: senderId, // UUID
                receiver_id: receiverId, // UUID
                content,
                is_read: false,
                // timestamp: new Date().toISOString(), // Si tu tabla lo requiere
            },
        ]);
        if (error) {
            console.error('Error sending message:', error);
            return;
        }
        // Opcional: recargar mensajes después de enviar
        await fetchConversation(senderId, receiverId);
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