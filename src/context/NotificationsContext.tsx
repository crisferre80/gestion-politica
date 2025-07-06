import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  read: boolean;
  created_at: string;
  related_id?: string;
};

type NotificationsContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  enableSound: boolean;
  setEnableSound: (enable: boolean) => void;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  return ctx;
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [enableSound, setEnableSound] = useState(() => {
    try {
      const saved = localStorage.getItem('eco_notification_sound');
      return saved !== null ? saved === 'true' : true; // Por defecto activado
    } catch {
      return true;
    }
  });
  
  const unreadCount = notifications.filter(n => !n.read).length;

  // Inicializar audio
  useEffect(() => {
    try {
      const audioElement = new Audio('/assets/alarma econecta.mp3');
      setAudio(audioElement);
    } catch (error) {
      console.error('Error al inicializar audio:', error);
    }
  }, []);

  // Guardar preferencia de sonido
  useEffect(() => {
    try {
      localStorage.setItem('eco_notification_sound', enableSound ? 'true' : 'false');
    } catch (error) {
      console.error('Error al guardar preferencia de sonido:', error);
    }
  }, [enableSound]);

  // Fetch inicial y en tiempo real
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }); // OK: solo columna raíz
      
      if (error) {
        console.error('Error al obtener notificaciones:', error);
        return;
      }
      
      if (data) setNotifications(data);
    } catch (err) {
      console.error('Error inesperado al cargar notificaciones:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    
    if (!user) return;
    
    // Suscripción en tiempo real mejorada con manejo de diferentes eventos
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          // Cuando se inserta una nueva notificación
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          
          // Reproducir sonido para notificaciones nuevas
          if (audio && enableSound) {
            audio.currentTime = 0;
            audio.play().catch(error => {
              console.error('Error al reproducir sonido de notificación:', error);
            });
            
            // Mostrar notificación del navegador si es posible
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('EcoNecta', {
                  body: newNotification.title,
                  icon: '/favicon.ico'
                });
              } catch (error) {
                console.error('Error al mostrar notificación del navegador:', error);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          // Cuando se actualiza una notificación existente
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) => 
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          // Cuando se elimina una notificación
          const oldId = payload.old.id;
          setNotifications((prev) => prev.filter(n => n.id !== oldId));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Suscripción a notificaciones en tiempo real activa');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error en el canal de suscripción de notificaciones');
          // Reintentar la suscripción después de un tiempo
          setTimeout(() => fetchNotifications(), 5000);
        }
      });

    // Solicitar permisos de notificación del navegador
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    return () => { 
      channel.unsubscribe(); 
    };
  }, [fetchNotifications, user, audio, enableSound]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      
      if (error) {
        console.error('Error al marcar notificación como leída:', error);
        return;
      }
      
      // Optimistic update
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error inesperado al actualizar notificación:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);
      
      if (error) {
        console.error('Error al marcar todas las notificaciones como leídas:', error);
        return;
      }
      
      // Optimistic update
      setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error inesperado al actualizar notificaciones:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error al eliminar notificación:', error);
        return;
      }
      
      // Optimistic update
      setNotifications((prev) => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error inesperado al eliminar notificación:', err);
    }
  };

  return (
    <NotificationsContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      fetchNotifications,
      deleteNotification,
      enableSound,
      setEnableSound
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};
