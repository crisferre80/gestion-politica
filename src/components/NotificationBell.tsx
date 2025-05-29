import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';

const NotificationBell: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

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

  return (
    <div className="relative" ref={bellRef}>
      <button
        className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none"
        onClick={() => setOpen(!open)}
        aria-label="Ver notificaciones"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="p-3 border-b font-semibold text-gray-700">Notificaciones</div>
          <ul className="divide-y divide-gray-100">
            {notifications.length === 0 && (
              <li className="p-4 text-gray-500 text-sm text-center">No tienes notificaciones</li>
            )}
            {notifications.map(n => (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-3 hover:bg-gray-50 transition cursor-pointer ${!n.read ? 'bg-gray-100' : ''}`}
                onClick={() => markAsRead(n.id)}
              >
                <div className="flex-1">
                  <div className="font-bold text-sm mb-0.5">{n.title}</div>
                  <div className="text-xs text-gray-600 mb-1">{n.content}</div>
                  <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.read && <span className="ml-2 mt-1 w-2 h-2 rounded-full bg-green-500" />}
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
      `}</style>
    </div>
  );
};

export default NotificationBell;
