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

    // Crear canal solo para cambios en los paneles de usuarios
    // Las notificaciones ya se manejan en NotificationsContext
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

    // Suscribirse al canal
    channelPanelChanges.subscribe();

    return () => {
      supabase.removeChannel(channelPanelChanges);
    };
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

  // Estado para controlar las notificaciones con animación de salida
  const [closingNotifications, setClosingNotifications] = useState<Set<string>>(new Set());
  
  // Estado para gestionar el deslizamiento
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipingNotification, setSwipingNotification] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
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
  
  // Funciones para manejar el deslizamiento
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setSwipingNotification(id);
    setSwipeOffset(0);
  };
  
  // Estado para controlar la vibración
  const [hasVibrated, setHasVibrated] = useState(false);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null || swipingNotification === null) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX;
    const deltaY = Math.abs(currentY - touchStartY);
    
    // Si el deslizamiento es más vertical que horizontal, ignorarlo
    if (deltaY > Math.abs(deltaX)) return;
    
    // Prevenir desplazamiento de la página durante el swipe horizontal
    e.preventDefault();
    
    // Limitar el desplazamiento a un rango razonable
    const offset = Math.min(Math.max(deltaX, -100), 100);
    setSwipeOffset(offset);
    
    // Dar feedback táctil cuando el usuario deslice lo suficiente para cerrar
    if (Math.abs(offset) > 50 && !hasVibrated && 'vibrate' in navigator) {
      navigator.vibrate(20);
      setHasVibrated(true);
    } else if (Math.abs(offset) <= 50) {
      setHasVibrated(false);
    }
  };
  
  const handleTouchEnd = () => {
    if (swipingNotification !== null && Math.abs(swipeOffset) > 50) {
      // Si se deslizó lo suficiente, cerrar la notificación
      handleCloseWithAnimation(swipingNotification);
    }
    
    // Reiniciar valores
    setTouchStartX(null);
    setTouchStartY(null);
    setSwipingNotification(null);
    setSwipeOffset(0);
  };
  
  // Detectar si es dispositivo móvil
  const [isMobile, setIsMobile] = useState(false);
  
  // Efecto para detectar si es dispositivo móvil
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Comprobar inicialmente
    checkIfMobile();
    
    // Comprobar cada vez que cambia el tamaño de la ventana
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  return (
    <div className={`
      fixed z-50 flex flex-col gap-3 max-w-xs w-full
      ${isMobile ? 'bottom-4 left-4 right-4 mx-auto' : 'top-4 right-4'}
    `}>
      {unread.slice(0, 3).map(n => (
        <div
          key={n.id}
          className={`
            flex items-start gap-3 p-4 rounded-2xl shadow-xl 
            ${isMobile ? 'border-t-8' : 'border-l-8'} 
            border-blue-500 bg-gradient-to-br from-blue-50 via-white to-blue-100 
            relative transition-all duration-300 
            ${closingNotifications.has(n.id) 
              ? (isMobile ? 'animate-slide-out-mobile' : 'animate-slide-out') 
              : (isMobile ? 'animate-slide-in-mobile' : 'animate-slide-in')
            }
            ${!closingNotifications.has(n.id) && 'hover:scale-[1.03] hover:shadow-2xl'}
            ${isMobile && 'swipe-notification'}
          `}
          data-notification-id={n.id}
          style={
            swipingNotification === n.id 
              ? { 
                  transform: `translateX(${swipeOffset}px)`, 
                  opacity: Math.max(0.5, 1 - Math.abs(swipeOffset) / 100)  // Disminuye la opacidad al deslizar
                } 
              : undefined
          }
          onTouchStart={isMobile ? (e) => handleTouchStart(e, n.id) : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
        >
          <div className="flex flex-col items-center justify-center mr-2">
            <span className="bg-blue-500 text-white rounded-full p-2 shadow-lg flex items-center justify-center">
              <Recycle className="w-6 h-6 text-blue-100 animate-spin-slow" />
            </span>
          </div>
          <div className="flex-1">
            <div className="font-bold text-blue-800 text-base flex items-center gap-2">
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
              <span className="text-xs text-blue-700 font-semibold italic">EcoNecta2</span>
            </div>
          </div>
          <button
            className="ml-2 text-gray-400 hover:text-blue-600 transition-colors text-xl"
            onClick={() => handleCloseWithAnimation(n.id)}
            aria-label="Marcar como leída"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        /* Animaciones para escritorio */
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-20px) scale(0.95); }
        }
        
        /* Animaciones para móvil (desde abajo) */
        @keyframes slide-in-mobile {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-out-mobile {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(20px) scale(0.95); }
        }
        
        /* Clases de animación */
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(.4,2,.6,1) forwards;
        }
        .animate-slide-out {
          animation: slide-out 0.4s cubic-bezier(.4,2,.6,1) forwards;
        }
        .animate-slide-in-mobile {
          animation: slide-in-mobile 0.4s cubic-bezier(.4,2,.6,1) forwards;
        }
        .animate-slide-out-mobile {
          animation: slide-out-mobile 0.4s cubic-bezier(.4,2,.6,1) forwards;
        }
        .animate-spin-slow {
          animation: spin 2.5s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        
        /* Estilos para permitir deslizamiento en móvil */
        .swipe-notification {
          touch-action: pan-x;
          user-select: none;
          transition: transform 0.1s ease-out;
        }
        
        /* Indicador de deslizamiento */
        @media (max-width: 768px) {
          .swipe-notification::after {
            content: '←';
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #10B981;
            opacity: 0.6;
            font-size: 1.2rem;
            animation: pulse 1.5s infinite;
          }
          
          @keyframes pulse {
            0% { opacity: 0.4; }
            50% { opacity: 0.8; }
            100% { opacity: 0.4; }
          }
        }
      `}</style>
    </div>
  );
}
