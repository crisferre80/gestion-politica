import { useNotifications } from '../context/NotificationsContext';
import { Sparkles } from 'lucide-react';

export default function Notifications() {
  const { notifications, markAsRead } = useNotifications();
  // Solo mostrar notificaciones no leídas en el popup
  const unread = notifications.filter(n => !n.read);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-xs w-full">
      {unread.slice(0, 3).map(n => (
        <div
          key={n.id}
          className={
            `flex items-start gap-3 p-4 rounded-2xl shadow-xl border-l-8 border-green-500 bg-gradient-to-br from-green-50 via-white to-green-100 relative animate-slide-in transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl`
          }
          style={{ animation: 'slide-in 0.4s cubic-bezier(.4,2,.6,1)' }}
        >
          <div className="flex flex-col items-center justify-center mr-2">
            <span className="bg-green-500 text-white rounded-full p-2 shadow-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
            </span>
          </div>
          <div className="flex-1">
            <div className="font-bold text-green-800 text-base flex items-center gap-2">
              {n.title}
            </div>
            <div className="text-sm text-gray-700 mb-1">{n.content}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
              <span className="text-xs text-green-700 font-semibold italic">EcoNecta2</span>
            </div>
          </div>
          <button
            className="ml-2 text-gray-400 hover:text-green-600 transition-colors"
            onClick={() => markAsRead(n.id)}
            aria-label="Marcar como leída"
          >
            ×
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
