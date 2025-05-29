import { useNotifications } from '../context/NotificationsContext';
import { X, Bell } from 'lucide-react';

const typeColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
};

export default function Notifications() {
  const { notifications, markAsRead } = useNotifications();
  // Solo mostrar notificaciones no leídas en el popup
  const unread = notifications.filter(n => !n.read);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-xs w-full">
      {unread.slice(0, 3).map(n => (
        <div
          key={n.id}
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border-l-4 animate-slide-in ${typeColors[n.type] || 'bg-green-50 text-gray-800'} relative`}
          style={{ animation: 'slide-in 0.4s cubic-bezier(.4,2,.6,1)'}}
        >
          <Bell className="w-5 h-5 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-bold">{n.title}</div>
            <div className="text-sx">{n.content}</div>
            <div className="text-xs text-red-500 mt-1">{new Date(n.created_at).toLocaleString()}</div>
          </div>
          <button
            className="ml-2 text-gray-400 hover:text-gray-700"
            onClick={() => markAsRead(n.id)}
            aria-label="Marcar como leída"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
