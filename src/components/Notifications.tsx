import { useNotifications } from '../context/NotificationsContext';
import { Recycle } from 'lucide-react';
import { useEffect, useState } from 'react';
import alarmaAudio from '/assets/alarma econecta.mp3';
import { supabase } from '../lib/supabase';

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
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    const audioElement = new Audio(alarmaAudio);
    setAudio(audioElement);

    const handleUserInteraction = () => {
      setUserInteracted(true);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };

    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  // Estado para controlar las notificaciones ya procesadas por el sistema de audio
  const [processedNotifications, setProcessedNotifications] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    // Solo procesar si tenemos audio y el usuario ha interactuado
    if (!audio || !userInteracted) return;
    
    // Filtramos notificaciones no leídas y que no hayan sido procesadas antes
    const unprocessedNotifications = notifications.filter(
      n => !n.read && !processedNotifications[n.id]
    );
    
    if (unprocessedNotifications.length > 0) {
      // Reproducir el sonido solo una vez por lote de notificaciones nuevas
      audio.currentTime = 0; // Reiniciar el audio para poder reproducirlo aunque ya se haya terminado
      audio.play().catch(error => {
        console.error('Error al reproducir el audio de notificación:', error);
      });
      
      // Marcar todas como procesadas
      const updatedProcessed = { ...processedNotifications };
      unprocessedNotifications.forEach(n => {
        updatedProcessed[n.id] = true;
      });
      setProcessedNotifications(updatedProcessed);
    }
  }, [notifications, audio, userInteracted, processedNotifications]);

  useEffect(() => {
    // Cargar cerradas de storage al cambiar de usuario
    setClosedIds(getClosedIdsFromStorage(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Crear dos canales separados para un mejor manejo de los eventos
    // Canal para cambios en los paneles de usuarios
    const channelPanelChanges = supabase.channel('panel-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_panels',
        filter: `user_id=eq.${userId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        if (payload.new) {
          console.log('Actualización en panel de usuario:', payload.new);
        }
      });

    // Canal específico para las notificaciones (opcional, si tienes una tabla de notificaciones)
    const channelNotifications = supabase.channel('notification-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        // Cuando llega una notificación nueva, reproducir el sonido
        if (audio && userInteracted) {
          audio.currentTime = 0;
          audio.play().catch(error => {
            console.error('Error al reproducir sonido de notificación en tiempo real:', error);
          });
        }
      });

    // Suscribirse a ambos canales
    channelPanelChanges.subscribe();
    channelNotifications.subscribe();

    return () => {
      supabase.removeChannel(channelPanelChanges);
      supabase.removeChannel(channelNotifications);
    };
  }, [userId, audio, userInteracted]);

  // Solo mostrar las no leídas y que no estén cerradas en los últimos 48h
  const closedIdSet = new Set(closedIds.map(c => c.id));
  const unread = notifications.filter(n => !n.read && !closedIdSet.has(n.id));

  const handleClose = (id: string) => {
    markAsRead(id);
    const updatedClosed = [...closedIds, { id, closedAt: Date.now() }];
    setClosedIds(updatedClosed);
    saveClosedIdsToStorage(userId, updatedClosed);
  };

  // Estado para controlar las notificaciones con animación de salida
  const [closingNotifications, setClosingNotifications] = useState<Set<string>>(new Set());
  
  // Manejador mejorado para cerrar notificaciones con animación
  const handleCloseWithAnimation = (id: string) => {
    // Marcar para animación de salida
    setClosingNotifications(prev => new Set(prev).add(id));
    
    // Esperar a que termine la animación antes de cerrarla realmente
    setTimeout(() => {
      handleClose(id);
      setClosingNotifications(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400); // Tiempo igual a la duración de la animación
  };
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-xs w-full">
      {unread.slice(0, 3).map(n => (
        <div
          key={n.id}
          className={`
            flex items-start gap-3 p-4 rounded-2xl shadow-xl border-l-8 
            border-green-500 bg-gradient-to-br from-green-50 via-white to-green-100 
            relative transition-all duration-300 
            ${closingNotifications.has(n.id) ? 'animate-slide-out' : 'animate-slide-in'}
            ${!closingNotifications.has(n.id) && 'hover:scale-[1.03] hover:shadow-2xl'}
          `}
        >
          <div className="flex flex-col items-center justify-center mr-2">
            <span className="bg-green-500 text-white rounded-full p-2 shadow-lg flex items-center justify-center">
              <Recycle className="w-6 h-6 text-green-100 animate-spin-slow" />
            </span>
          </div>
          <div className="flex-1">
            <div className="font-bold text-green-800 text-base flex items-center gap-2">
              {n.title}
            </div>
            <div className="text-sm text-gray-700 mb-1">{n.content}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">
                {new Intl.DateTimeFormat('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }).format(new Date(n.created_at))}
              </span>
              <span className="text-xs text-green-700 font-semibold italic">EcoNecta2</span>
            </div>
          </div>
          <button
            className="ml-2 text-gray-400 hover:text-green-600 transition-colors text-xl"
            onClick={() => handleCloseWithAnimation(n.id)}
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
        @keyframes slide-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-20px) scale(0.95); }
        }
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(.4,2,.6,1) forwards;
        }
        .animate-slide-out {
          animation: slide-out 0.4s cubic-bezier(.4,2,.6,1) forwards;
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
