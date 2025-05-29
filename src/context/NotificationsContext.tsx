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
  markAsRead: (id: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
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

  // Fetch inicial y en tiempo real
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setNotifications(data);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    // Suscripción en tiempo real
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [fetchNotifications, user]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <NotificationsContext.Provider value={{ notifications, markAsRead, fetchNotifications }}>
      {children}
    </NotificationsContext.Provider>
  );
};
