import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
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
    // Guardar los userId activos para la conversación
    const activeUserIds = useRef<{ userId1?: string; userId2?: string }>({});

    // Cargar mensajes entre dos usuarios (usando user_id de Auth)
    const fetchConversation = async (userId1: string, userId2: string) => {
        activeUserIds.current = { userId1, userId2 };
        // Buscar mensajes usando directamente los user_id (UUID de Auth)
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(
                `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
            )
            .order('sent_at', { ascending: true });
        if (error) {
            console.error('Error fetching messages:', error);
            setMessages([]);
            return;
        }
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
                senderId: msg.sender_id,
                receiverId: msg.receiver_id,
                content: msg.content,
                timestamp: new Date(msg.sent_at),
                createdAt: msg.sent_at
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

    // Suscripción realtime a nuevos mensajes entre los dos usuarios activos
    useEffect(() => {
        if (!activeUserIds.current.userId1 || !activeUserIds.current.userId2) return;
        const { userId1, userId2 } = activeUserIds.current;
        // Canal único para la conversación
        const channel = supabase.channel(`messages-realtime-${userId1}-${userId2}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `or(and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1}))`,
            }, () => {
                // Solo recargar si el mensaje es entre los dos usuarios activos
                fetchConversation(userId1, userId2);
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [messages.length]); // Se re-crea la suscripción si cambia la conversación

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