import { useNotifications } from '../context/NotificationsContext';
import { Recycle } from 'lucide-react';
import { useEffect, useState } from 'react';
import alarmaAudio from '../../public/assets/alarma-econecta.mp3';

function getClosedIdsFromStorage(userId: string | undefined) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`eco_closed_notifications_${userId}`);
    const arr = raw ? JSON.parse(raw) : [];
    // Filtrar solo las que no han expirado (48h)
    const now = Date.now();
    const filtered = arr.filter((item: { id: string; closedAt: number }) => now - item.closedAt < 48 * 60 * 60 * 1000);
    // Limpieza de expirados
    if (filtered.length !== arr.length) {
      localStorage.setItem(`eco_closed_notifications_${userId}`, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}
function saveClosedIdsToStorage(userId: string | undefined, ids: { id: string; closedAt: number }[]) {
  if (!userId) return;
  localStorage.setItem(`eco_closed_notifications_${userId}`, JSON.stringify(ids));
}

export default function Notifications() {
  const { notifications, markAsRead } = useNotifications();
  const userId = notifications[0]?.user_id;
  const [closedIds, setClosedIds] = useState<{ id: string; closedAt: number }[]>(() => getClosedIdsFromStorage(userId));

  useEffect(() => {
    // Reproducir audio al recibir nuevas notificaciones
    if (notifications.length > 0) {
      const audio = new Audio(alarmaAudio);
      audio.play().catch(error => console.error('Error al reproducir el audio:', error));
    }
  }, [notifications]);

  useEffect(() => {
    // Cargar cerradas de storage al cambiar de usuario
    setClosedIds(getClosedIdsFromStorage(userId));
  }, [userId]);

  // Solo mostrar las no leídas y que no estén cerradas en los últimos 48h
  const closedIdSet = new Set(closedIds.map(c => c.id));
  const unread = notifications.filter(n => !n.read && !closedIdSet.has(n.id));

  const handleClose = (id: string) => {
    markAsRead(id);
    const updatedClosed = [...closedIds, { id, closedAt: Date.now() }];
    setClosedIds(updatedClosed);
    saveClosedIdsToStorage(userId, updatedClosed);
  };

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
              {/* Cambiado Sparkles por Recycle */}
              <Recycle className="w-6 h-6 text-green-100 animate-spin-slow" />
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
            onClick={() => handleClose(n.id)}
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
        .animate-spin-slow {
          animation: spin 2.5s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
