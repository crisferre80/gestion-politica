import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Message = {
    id: string;
    senderId: string;
    receiverId: string;
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
        setMessages(
            (data ?? []).map((msg: any) => ({
                id: msg.id.toString(),
                senderId: msg.sender_id,
                receiverId: msg.receiver_id,
                content: msg.content,
                timestamp: new Date(msg.created_at),
            }))
        );
    };

    // Enviar mensaje y recargar la conversación
    const sendMessage = async (senderId: string, receiverId: string, content: string) => {
        const { error } = await supabase.from('messages').insert([
            {
                sender_id: senderId,
                receiver_id: receiverId,
                content,
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

export const useMessages = () => {
    const context = useContext(MessagesContext);
    if (!context) {
        throw new Error('useMessages must be used within a MessagesProvider');
    }
    return context;
};