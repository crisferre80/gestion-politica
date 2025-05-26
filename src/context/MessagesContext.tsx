import { createContext, useContext, useState, ReactNode } from 'react';

export type Message = {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: Date;
};

type MessagesContextType = {
    messages: Message[];
    sendMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    getConversation: (userId1: string, userId2: string) => Message[];
};

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider = ({ children }: { children: ReactNode }) => {
    const [messages, setMessages] = useState<Message[]>([]);

    const sendMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
    };

    const getConversation = (userId1: string, userId2: string) => {
        return messages.filter(
            (msg) =>
                (msg.senderId === userId1 && msg.receiverId === userId2) ||
                (msg.senderId === userId2 && msg.receiverId === userId1)
        );
    };

    return (
        <MessagesContext.Provider value={{ messages, sendMessage, getConversation }}>
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