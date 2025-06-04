import React from 'react';
import { User, Clock } from 'lucide-react';

interface Message {
  content: string;
  created_at: string | number | Date;
}

interface ChatListProps {
  chats: Array<{
    userId: string;
    name: string;
    avatar_url?: string;
    lastMessage?: Message;
    unreadCount: number;
  }>;
  onChatSelect: (userId: string) => void;
  selectedUserId?: string;
}

const ChatList: React.FC<ChatListProps> = ({ chats, onChatSelect, selectedUserId }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Mensajes</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {chats.map((chat) => (
          <button
            key={chat.userId}
            onClick={() => onChatSelect(chat.userId)}
            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
              selectedUserId === chat.userId ? 'bg-green-50' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                {chat.avatar_url ? (
                  <img
                    src={chat.avatar_url}
                    alt={chat.name}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="h-6 w-6 text-green-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {chat.name}
                  </p>
                  {chat.lastMessage && (
                    <p className="text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(chat.lastMessage.created_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                {chat.lastMessage && (
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessage.content}
                  </p>
                )}
              </div>
              {chat.unreadCount > 0 && (
                <div className="ml-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                    {chat.unreadCount}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
        {chats.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No hay conversaciones activas
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;