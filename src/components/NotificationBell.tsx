import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Volume2, VolumeX } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, enableSound, setEnableSound } = useNotifications();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleNotificationClick = (id: string) => {
    markAsRead(id);
    // Aquí podrías añadir navegación a una página relacionada con la notificación
  };

  const toggleSound = () => {
    setEnableSound(!enableSound);
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none"
        onClick={() => setOpen(!open)}
        aria-label="Ver notificaciones"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="p-3 border-b font-semibold text-gray-700 flex justify-between items-center">
            <span>Notificaciones</span>
            <div className="flex gap-2">
              <button 
                onClick={toggleSound}
                className={`text-xs p-1 rounded ${enableSound ? 'text-blue-600' : 'text-gray-400'}`}
                title={enableSound ? "Sonido activado" : "Sonido desactivado"}
              >
                {enableSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllAsRead()}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <Check className="w-3 h-3" />
                  <span>Marcar todas</span>
                </button>
              )}
            </div>
          </div>
          <ul className="divide-y divide-gray-100">
            {notifications.length === 0 && (
              <li className="p-4 text-gray-500 text-sm text-center">No tienes notificaciones</li>
            )}
            {notifications.map(n => (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-3 hover:bg-gray-50 transition cursor-pointer ${!n.read ? 'bg-gray-50' : ''}`}
                onClick={() => handleNotificationClick(n.id)}
              >
                <div className="flex-1">
                  <div className={`font-bold text-sm mb-0.5 ${!n.read ? 'text-blue-700' : ''}`}>{n.title}</div>
                  <div className="text-xs text-gray-600 mb-1">{n.content}</div>
                  <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.read && <span className="ml-2 mt-1 w-2 h-2 rounded-full bg-blue-500" />}
              </li>
            ))}
          </ul>
        </div>
      )}
      <style>{`
        .animate-fade-in { animation: fadeInUp 0.25s; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
