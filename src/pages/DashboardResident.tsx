import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaMapMarkerAlt, FaUserCircle, FaRecycle, FaWallet, FaHistory, FaPlus, FaMapPin, FaCalendarAlt, FaStar, FaEnvelope, FaPhone, FaTimes } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, transformImage } from '../services/ImageTransformService';
import ChatList from '../components/ChatList';
import Map from '../components/Map';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast';
import PhotoCapture from '../components/PhotoCapture';
import EstadisticasPanel from '../components/EstadisticasPanel';
import { getAvatarUrl } from '../utils/feedbackHelper';

// Tipo para el payload de realtime de perfiles
export type ProfileRealtimePayload = {
  dni: string | undefined;
  id: string; // <-- Cambiado a string (uuid)
  user_id?: string; // <-- Agregado para acceso correcto
  avatar_url?: string;
  name?: string;
  email?: string;
  phone?: string;
  rating_average?: number;
  total_ratings?: number;
  materials?: string[] | string; // <-- Puede ser string[] o string
  bio?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  online?: boolean | string | number; // <-- Puede venir como string, number o boolean
  role?: string;
};

type CollectionPoint = {
  additional_info: boolean | string; // Puede ser string según tu tabla
  notas: string;
  id: string; // <-- Cambiado a string (uuid)
  address: string;
  district: string;
  schedule: string;
  user_id: string;
  lat?: number;
  lng?: number;
  materials?: string[]; // <-- Añadido explícitamente
  photo_url?: string; // <-- URL de la imagen del material
  type?: string; // <-- Añadido para evitar error de propiedad inexistente
  // Agrega aquí otros campos si existen en tu tabla
};

export type User = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  address?: string;
  materials?: string[];
  schedule?: string;
  type?: string;
  bio?: string;
  role?: string; // 'role' ahora es opcional para compatibilidad
  header_image_url?: string; // Añadido para evitar error de propiedad inexistente
  // otros campos...
};

const DashboardResident = () => {
  const { user, login } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  
  // Flag para controlar logging de debug (solo en desarrollo)
  const isDebugMode = process.env.NODE_ENV === 'development';
  
  // Estado para controlar el throttling de notificaciones
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const NOTIFICATION_COOLDOWN = 3000; // 3 segundos entre notificaciones
   
  // const [] = useState(false);
   
  // const [someState, setSomeState] = useState(false); // Removed invalid empty array destructuring
  // const [] = useState(false);
  // const [] = useState(false);
  type Recycler = {
    role: string;
    id: string; // <-- Cambiado a string
    user_id?: string;
    profiles?: {
      avatar_url?: string;
      name?: string;
      email?: string;
      phone?: string;
      dni?: string; // Agrega el campo dni al objeto de perfiles
      // Add more specific fields if needed
    };
    rating_average?: number;
    total_ratings?: number;
    materials?: string[];
    bio?: string;
    lat?: number;
    lng?: number;
    online?: boolean;
    // Add more specific fields if needed
  };
  
    // --- Estado de Dirigentes en línea con persistencia en sessionStorage ---
const [recyclers, setRecyclers] = useState<Recycler[]>(() => {
  const cached = sessionStorage.getItem('recyclers_online');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }
  return [];
});

// Tipo local para filas de perfil retornadas por Supabase
type ProfileRow = {
  id?: string;
  user_id?: string;
  name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  dni?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  role?: string;
  bio?: string;
  materials?: string[] | string | null;
  rating_average?: number | null;
  total_ratings?: number | null;
  online?: boolean | number | string;
};

// Función para obtener recicladores online (usada por varios efectos)
const fetchOnlineRecyclers = useCallback(async () => {
  if (!user?.id) return;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, name, avatar_url, lat, lng, role, bio, materials, rating_average, total_ratings')
      .eq('role', 'recycler')
      .limit(500);
    if (!error && data) {
      const normalized: Recycler[] = (data as ProfileRow[]).map(d => ({
        id: String(d.id || d.user_id || ''),
        user_id: d.user_id,
        role: d.role || 'recycler',
        profiles: { name: d.name, avatar_url: d.avatar_url, email: d.email, phone: d.phone, dni: d.dni },
        lat: typeof d.lat === 'string' ? Number(d.lat) : (typeof d.lat === 'number' ? d.lat : undefined),
        lng: typeof d.lng === 'string' ? Number(d.lng) : (typeof d.lng === 'number' ? d.lng : undefined),
        bio: d.bio,
        materials: Array.isArray(d.materials) ? d.materials : (d.materials ? String(d.materials).split(',').map((s: string) => s.trim()) : []),
        rating_average: d.rating_average ?? undefined,
        total_ratings: d.total_ratings ?? undefined,
        online: !!d.online,
      }));
      setRecyclers(normalized);
    }
  } catch (err) {
    if (isDebugMode) console.error('[fetchOnlineRecyclers] Error:', err);
  }
}, [user, isDebugMode]);

  // Estado para controlar solicitudes de fitBounds/centrado al Map
  const [mapFitBounds, setMapFitBounds] = useState<[[number, number],[number, number]] | null>(null);
  const [mapCenterToUser, setMapCenterToUser] = useState<boolean>(false);

// --- Persistencia de estado del tab activo ---
const [activeTab, setActiveTab] = useState<'puntos' | 'Dirigentes' | 'perfil' | 'ecocuenta' | 'historial' | 'mensajes'>(() => {
  // Verificar si hay un parámetro de tab en la URL
  const urlParams = new URLSearchParams(location.search);
  const urlTab = urlParams.get('tab');
  
  if (urlTab === 'puntos' || urlTab === 'Dirigentes' || urlTab === 'perfil' || urlTab === 'ecocuenta' || urlTab === 'historial' || urlTab === 'mensajes') {
    return urlTab;
  }
  
  // Si no hay parámetro de URL, usar el cached
  const cachedTab = sessionStorage.getItem('dashboard_resident_active_tab');
  if (cachedTab === 'puntos' || cachedTab === 'Dirigentes' || cachedTab === 'perfil' || cachedTab === 'ecocuenta' || cachedTab === 'historial' || cachedTab === 'mensajes') {
    return cachedTab;
  }
  return 'puntos';
});

// --- Sincronizar cambios de Dirigentes y tab con sessionStorage ---
useEffect(() => {
  sessionStorage.setItem('recyclers_online', JSON.stringify(recyclers));
}, [recyclers]);

useEffect(() => {
  sessionStorage.setItem('dashboard_resident_active_tab', activeTab);
}, [activeTab]);

  // --- Estado y lógica para badge de mensajes ---

  useEffect(() => {
    // Efecto para mantener lista de recicladores online y suscripción realtime
    let isMounted = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    // Fetch inicial
    (async () => {
      await fetchOnlineRecyclers();
    })();

    // Función para crear la suscripción con manejo mejorado de errores
    const createRecyclersSubscription = () => {
      const channelName = `recyclers-profiles`;
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: 'recyclers' }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: "role=eq.recycler",
      }, () => {
        if (!isMounted) return;
        fetchOnlineRecyclers();
      })
      .subscribe((status, err) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[REALTIME] Estado suscripción Dirigentes:', status);
          if (err) console.error('[REALTIME] Error suscripción Dirigentes:', err);
        }

        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[REALTIME] Conexión Dirigentes perdida. Estado:', status);
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(2000 * reconnectAttempts, 10000);
            reconnectTimeout = setTimeout(() => {
              supabase.removeChannel(channel);
              createRecyclersSubscription();
            }, delay);
          }
        }
      });

      return channel;
    };

    const channel = createRecyclersSubscription();
    const interval = setInterval(() => { if (isMounted) fetchOnlineRecyclers(); }, 5000);

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout as NodeJS.Timeout);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchOnlineRecyclers, isDebugMode]);

  // Estado para la pestaña activa (activeTab)
  type DetailedPoint = CollectionPoint & {
    status?: string;
    claim_id?: string | null; // <-- Añadido para acceso seguro
    claim?: {
      id?: string; // <-- Añadido para fallback
      status?: string;
      pickup_time?: string;
      recycler?: {
        id?: string;
        user_id?: string;
        name?: string;
        avatar_url?: string;
        email?: string;
        phone?: string;
        alias?: string; // <-- Añadido para permitir alias
      };
    } | null; // <-- Permitir null explícitamente
    created_at?: string; // <-- Añadido para acceso seguro a la fecha de creación
    type?: string; // <-- Añadido para evitar error de propiedad inexistente
  };
  
  const [detailedPoints, setDetailedPoints] = useState<DetailedPoint[]>([]);
  
  // Estado para indicar cuando se están actualizando los datos en tiempo real
  const [isUpdatingRealtime, setIsUpdatingRealtime] = useState(false);

  // Función para cargar puntos (sin lógica de claims)
  const fetchDetailedPoints = useCallback(async () => {
    if (!user?.id) return;

    setIsUpdatingRealtime(true);

    try {
      const { data, error } = await supabase
        .from('concentration_points')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (isDebugMode) {
        console.log('[DEBUG] Consulta concentration_points resultado:', { data, error });
      }

      if (!error && data) {
        setDetailedPoints(data as DetailedPoint[]);
      } else {
        setDetailedPoints([]);
      }
    } catch (err) {
      if (isDebugMode) console.error('[ERROR] Error inesperado al cargar puntos:', err);
      setDetailedPoints([]);
    } finally {
      setTimeout(() => setIsUpdatingRealtime(false), 300);
    }
  }, [user, isDebugMode]);

  // Función para mostrar notificación automatizada con throttling
  const showAutomaticNotification = useCallback((message: string, options: { icon?: string; duration?: number; type?: 'success' | 'error' | 'info' } = {}) => {
    const now = Date.now();
    
    // Verificar throttling para evitar spam
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
      if (isDebugMode) {
        console.log('[NOTIFICATION] Saltando notificación por throttling');
      }
      return;
    }
    
    setLastNotificationTime(now);
    
    // Solo reproducir sonido para notificaciones importantes
    if (options.type !== 'error') {
      playNotificationSound();
    }
    
    // Configuración por defecto optimizada
    const defaultOptions = {
      duration: options.duration || 6000,
      icon: options.icon || '🔔',
      style: {
        background: options.type === 'error' ? '#EF4444' : '#10B981',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '14px',
        maxWidth: '420px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }
    };
    
    toast.success(message, defaultOptions);
  }, [lastNotificationTime, isDebugMode, NOTIFICATION_COOLDOWN]);

  // Cargar puntos con detalles de reclamo y reciclador
  useEffect(() => {
    if (!user?.id) return;
    
    // Fetch inicial
    fetchDetailedPoints();

    // Auto-actualización periódica cada 30 segundos para mantener datos frescos
    const autoUpdateInterval = setInterval(() => {
      fetchDetailedPoints();
    }, 30000);

    // Estado para control de reconexión
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout;

    // Función para crear la suscripción con configuración mejorada
    const createSubscription = () => {
      const channelName = `resident-dashboard-${user.id}-${Date.now()}`;
      
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
  table: 'concentration_points',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (isDebugMode) {
          console.log('[REALTIME] Cambio en concentration_points para usuario:', payload);
        }
        // Actualizar inmediatamente solo para cambios en nuestros puntos
        fetchDetailedPoints();
      })
  // Eliminadas suscripciones a collection_claims (la app ahora solo gestiona concentration_points)
      .subscribe((status, err) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[REALTIME] Estado de suscripción:', status);
          if (err) console.error('[REALTIME] Error en suscripción:', err);
        }

        if (status === 'SUBSCRIBED') {
          console.log('[REALTIME] ¡Suscripción activa para usuario:', user.id);
          reconnectAttempts = 0; // Reset attempts on successful connection
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[REALTIME] Conexión perdida. Estado:', status);
          
          // Intentar reconectar si no hemos excedido el límite
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
            
            console.log(`[REALTIME] Reintentando conexión en ${delay}ms (intento ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              if (isDebugMode) {
                console.log('[REALTIME] Reintentando suscripción...');
              }
              supabase.removeChannel(channel);
              createSubscription();
            }, delay);
          } else {
            console.error('[REALTIME] Máximo número de intentos de reconexión alcanzado');
          }
        }
      });

      return channel;
    };

    // Crear la suscripción inicial
    const channel = createSubscription();

    return () => {
      if (isDebugMode) {
        console.log('[REALTIME] Limpiando suscripción...');
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      supabase.removeChannel(channel);
      clearInterval(autoUpdateInterval);
    };
  }, [user, fetchDetailedPoints, showAutomaticNotification, isDebugMode]);

  // Auto-refresh cuando la pestaña vuelve a estar activa
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        // Refrescar datos cuando el usuario vuelve a la pestaña
        fetchDetailedPoints();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDetailedPoints, user]);

  // Filtrado por sub-tab
  
  // Cuando el usuario selecciona la pestaña 'Mis Puntos', forzar un fetch inmediato
  useEffect(() => {
    if (activeTab === 'puntos' && user?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[INFO] activeTab cambió a puntos — cargando concentration_points');
      }
      fetchDetailedPoints();
    }
  }, [activeTab, user, fetchDetailedPoints]);
    // Estado para sub-pestañas de puntos (todos, reclamados, demorados, retirados, disponibles)
    const [activePointsTab, setActivePointsTab] = useState<'todos' | 'reclamados' | 'demorados' | 'retirados' | 'disponibles'>(() => 'todos');
  // Normaliza claim: si es array, toma el primero; si es objeto, lo deja igual
// Tipos para los claims y Dirigentes
// RecyclerType eliminado (no usado en este componente)

// ClaimType eliminado (la app ya no usa collection_claims en el cliente)

// Categorías simples basadas en `status` del punto
  const puntosTodos = detailedPoints.filter(p => !p.status || p.status === 'available');
const puntosReclamados = detailedPoints.filter(p => p.status === 'claimed');
const puntosRetirados = detailedPoints.filter(p => p.status === 'completed' || p.status === 'retired');
const puntosDemorados = detailedPoints.filter(p => p.status === 'delayed');

  // DEBUG LOGS - Solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] Total detailedPoints:', detailedPoints.length);
  console.log('[DEBUG] puntosTodos:', puntosTodos.length, puntosTodos.map(p => p.id));
  console.log('[DEBUG] puntosReclamados:', puntosReclamados.length, puntosReclamados.map(p => p.id));
  console.log('[DEBUG] puntosRetirados:', puntosRetirados.length, puntosRetirados.map(p => p.id));
  console.log('[DEBUG] puntosDemorados:', puntosDemorados.length, puntosDemorados.map(p => p.id));
  }

  // Función para volver a poner un punto como disponible
  const handleMakeAvailableAgain = async (point: DetailedPoint) => {
    try {
      // 1. Crear un nuevo punto disponible (NO copiar campos de reclamo)
      const { data: newPoint, error: createError } = await supabase
        .from('concentration_points')
        .insert({
          address: point.address,
          district: point.district,
          schedule: point.schedule,
          user_id: point.user_id,
          notas: point.notas,
          additional_info: point.additional_info,
          status: 'available',
          lat: point.lat ?? null,
          lng: point.lng ?? null,
          materials: point.materials ?? [],
          // Nunca copiar claim_id, pickup_time, recycler_id ni campos de reclamo
        })
        .select()
        .single();
      if (createError || !newPoint) {
        toast.error('Error al crear el nuevo punto disponible.');
        return;
      }
      // 2. Eliminar el punto retirado de la base de datos
      await supabase
        .from('concentration_points')
        .delete()
        .eq('id', point.id);
      // 3. Actualizar el estado local: quitar el retirado y agregar el nuevo disponible
      setDetailedPoints(prev => [
        ...prev.filter(p => p.id !== point.id),
        { ...newPoint, claim: null, claim_id: null }
      ]);
      toast.success('El punto ha sido reactivado como disponible.');
    } catch (err) {
      toast.error('Error al volver a poner el punto como disponible.');
      console.error(err);
    }
  };

  // Función para eliminar un punto de recolección
  const handleDeletePoint = async (point: DetailedPoint) => {
    try {
      // Elimina el punto de recolección
      await supabase
        .from('concentration_points')
        .delete()
        .eq('id', point.id);
      toast.success('Punto eliminado correctamente.');
      // Elimina el punto del estado local inmediatamente
      setDetailedPoints(prev => prev.filter(p => p.id !== point.id));
    } catch (err) {
      toast.error('Error al eliminar el punto.');
      console.error(err);
    }
  };

  // (Eliminada función handleClaimPoint porque no se utiliza)

// ratings removed

// --- Estado para el modal de donación ---
const [showDonationModal, setShowDonationModal] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string; alias?: string } | null>(null);
const [donationAmount, setDonationAmount] = useState<number>(0);

// Estado para el objetivo de calificación (modal de calificaciones)
const [, setRatingTarget] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string } | null>(null);

// --- Estado para el modal de edición de imagen de cabecera ---
const [showHeaderImageModal, setShowHeaderImageModal] = useState(false);

// --- Estado para mensajes no leídos por reciclador ---
const [unreadMessagesByRecycler, setUnreadMessagesByRecycler] = useState<Record<string, number>>({});

// Estado para la lista de conversaciones en el panel de Mensajes
const [chatPreviews, setChatPreviews] = useState<Array<{
  userId: string;
  name: string;
  avatar_url?: string;
  lastMessage?: { content: string; created_at: string } | null;
  unreadCount: number;
}>>([]);
const [, setLoadingChats] = useState(false);

// --- Efecto para cargar y suscribirse a mensajes no leídos ---
useEffect(() => {
  if (!user?.id || recyclers.length === 0) return;
  let isMounted = true;
  // Función para cargar los mensajes no leídos por reciclador
  const fetchUnread = async () => {
    const recyclerUserIds = recyclers.map(r => r.user_id).filter(Boolean);
    if (recyclerUserIds.length === 0) return;
    // Buscar mensajes no leídos enviados por cada reciclador al Dirigente
    const { data, error } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, read')
      .in('sender_id', recyclerUserIds)
      .eq('receiver_id', user.id)
      .eq('read', false);
    if (error) return;
    // Agrupar por sender_id
    const counts: Record<string, number> = {};
    (data || []).forEach(msg => {
      counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
    });
    if (isMounted) setUnreadMessagesByRecycler(counts);
  };
  fetchUnread();
  // Suscripción realtime a nuevos mensajes con manejo mejorado de errores
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let reconnectTimeout: NodeJS.Timeout;

  const createMessagesSubscription = () => {
    const channelName = `resident-messages-badge-${user.id}-${Date.now()}`;
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: `messages-${user.id}` }
      }
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id=eq.${user.id}`,
    }, fetchUnread)
    .subscribe((status, err) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[REALTIME] Estado suscripción mensajes:', status);
        if (err) console.error('[REALTIME] Error suscripción mensajes:', err);
      }

      if (status === 'SUBSCRIBED') {
        reconnectAttempts = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = 1000 * reconnectAttempts;
          
          reconnectTimeout = setTimeout(() => {
            supabase.removeChannel(channel);
            createMessagesSubscription();
          }, delay);
        }
      }
    });

    return channel;
  };

  const channel = createMessagesSubscription();

  return () => {
    isMounted = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    supabase.removeChannel(channel);
  };
}, [user, recyclers]);

// Cargar previsualizaciones de chat cuando el usuario abre la pestaña Mensajes
useEffect(() => {
  if (!user?.id || activeTab !== 'mensajes') return;
  let isMounted = true;
  (async () => {
    setLoadingChats(true);
    try {
      // Obtener mensajes que involucren al usuario
      const { data: messages, error } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, sent_at, read')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('sent_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error('[Mensajes] Error cargando mensajes:', error);
        setChatPreviews([]);
        return;
      }

      // Construir mapa de conversaciones por otroUserId
      const map: Record<string, { lastMessage?: { content: string; created_at: string }; unreadCount: number }> = {};
      (messages || []).forEach((m: { sender_id: string; receiver_id: string; content: string; sent_at: string; read: boolean }) => {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!other) return;
        if (!map[other]) map[other] = { lastMessage: undefined, unreadCount: 0 };
        // El primer mensaje (porque orden desc) es el último
        if (!map[other].lastMessage) map[other].lastMessage = { content: m.content, created_at: m.sent_at };
        if (m.sender_id === other && m.receiver_id === user.id && m.read === false) {
          map[other].unreadCount += 1;
        }
      });

      const otherUserIds = Object.keys(map);
      if (otherUserIds.length === 0) {
        if (isMounted) setChatPreviews([]);
        return;
      }

      // Obtener perfiles de esos usuarios
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', otherUserIds as string[]);

      const profileMap: Record<string, { name?: string; avatar_url?: string }> = {};
      interface ProfilePreview {
        user_id: string;
        name?: string;
        avatar_url?: string;
      }
      (profiles as ProfilePreview[] || []).forEach((p) => {
        profileMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url };
      });

      const previews = otherUserIds.map(id => ({
        userId: id,
        name: profileMap[id]?.name || 'Usuario',
        avatar_url: profileMap[id]?.avatar_url,
        lastMessage: map[id].lastMessage || undefined,
        unreadCount: map[id].unreadCount || 0,
      }));

      if (isMounted) setChatPreviews(previews);
    } catch (err) {
      console.error('[Mensajes] Error inesperado:', err);
      if (isMounted) setChatPreviews([]);
    } finally {
      if (isMounted) setLoadingChats(false);
    }
  })();
  return () => { isMounted = false; };
}, [user, activeTab]);

// Limpiar badge de un reciclador al abrir el chat
const clearUnreadForRecycler = async (recyclerUserId: string) => {
  if (!user?.id) return;
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('receiver_id', user.id)
    .eq('sender_id', recyclerUserId)
    .eq('read', false);
  setUnreadMessagesByRecycler(prev => ({ ...prev, [recyclerUserId]: 0 }));
};

// Limpiar todos los badges al abrir la pestaña de Dirigentes
useEffect(() => {
  if (activeTab === 'Dirigentes') {
    (async () => {
      if (!user?.id) return;
      const recyclerUserIds = recyclers.map(r => r.user_id).filter(Boolean);
      if (recyclerUserIds.length === 0) return;
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .in('sender_id', recyclerUserIds)
        .eq('read', false);
      setUnreadMessagesByRecycler({});
    })();
  }
}, [activeTab, user, recyclers]);

  useEffect(() => {
    // Refresca puntos si se navega con el flag refresh (tras crear un punto)
    const locState = (location as typeof location & { state?: unknown }).state as { refresh?: boolean } | undefined;
    if (locState && locState.refresh) {
      // refreshCollectionPoints(); // Eliminar o comentar
      // Limpia el state para evitar refrescos innecesarios al navegar de nuevo
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Eliminamos la función local y usamos la centralizada desde feedbackHelper
  // Esta línea se conserva solo para documentación, pero no tiene efecto
  // La función anterior solo reemplazaba rutas internas, pero no manejaba casos cuando no hay URL

  // Estado para mostrar el modal de eliminar cuenta
  // (Funcionalidad movida al navbar)

  // Definir estados para edición de perfil
const [editName, setEditName] = useState(user?.name || '');
const [editEmail, setEditEmail] = useState(user?.email || '');
const [editPhone, setEditPhone] = useState(user?.phone || '');
const [editAddress, setEditAddress] = useState(user?.address || '');
const [editBio, setEditBio] = useState(user?.bio || '');
const [editMaterials, setEditMaterials] = useState(user?.materials?.join(', ') || '');

// --- Estado para EcoCreditos y recompensas ---
const [ecoCreditos, setEcoCreditos] = useState<number>(0);
const [ecoReward, setEcoReward] = useState<string | null>(null);
const [ecoRewardVisible, setEcoRewardVisible] = useState(false);
const [lastEcoRewardStep, setLastEcoRewardStep] = useState<number>(0);

// Cargar EcoCreditos al cargar el usuario
useEffect(() => {
  async function fetchEcoCreditos() {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('eco_creditos')
      .eq('user_id', user.id)
      .single();
    if (!error && data) {
      setEcoCreditos(data.eco_creditos || 0);
    }
  }
  fetchEcoCreditos();
  // Suscripción en tiempo real a cambios de eco_creditos
  const channel = supabase.channel('eco-creditos-resident')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'profiles',
      filter: `user_id=eq.${user?.id}`,
    }, (payload) => {
      const newData = payload.new as { eco_creditos?: number };
      if (newData && typeof newData.eco_creditos === 'number') {
        setEcoCreditos(newData.eco_creditos);
      }
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);

// Mostrar ecoReward solo durante 60s al alcanzar múltiplos de 50
useEffect(() => {
  if (ecoCreditos >= 50 && ecoCreditos % 50 === 0 && ecoCreditos !== lastEcoRewardStep) {
    setEcoReward('¡Felicidades! Has ganado un eco canje (planta o árbol).');
    setEcoRewardVisible(true);
    setLastEcoRewardStep(ecoCreditos);
    const timeout = setTimeout(() => {
      setEcoRewardVisible(false);
    }, 6000);
    return () => clearTimeout(timeout);
  } else if (ecoCreditos < 50 || ecoCreditos % 50 !== 0) {
    setEcoRewardVisible(false);
    setEcoReward(null);
  }
}, [ecoCreditos, lastEcoRewardStep]);

  // Sube el avatar a Supabase Storage y retorna la URL pública
  async function uploadAvatar(file: File, userId: string): Promise<string | null> {
    if (!file || !userId) return null;
    
    try {
      // Paso 1: Procesar la imagen para asegurar que no exceda los 300 KB
      if (process.env.NODE_ENV === 'development') {
        console.log('[uploadAvatar] Procesando imagen con límite de 300KB');
      }
      const processedBase64 = await prepareImageForUpload(file, 300); // 300 KB máximo para avatar
      if (!processedBase64) {
        return null;
      }
      
      // Paso 2: Aplicar transformaciones adicionales para avatar (cuadrado)
      const avatarTransformed = await transformImage(processedBase64, {
        width: 400, // Dimensión recomendada para avatar
        height: 400, // Cuadrado
        quality: 75,  // Calidad ajustada para mantener bajo los 300KB
        format: 'jpeg',
        name: 'avatar-image'
      });
      
      if (!avatarTransformed.success) {
        console.error('Error al transformar avatar:', avatarTransformed.error);
        return null;
      }
      
      // Convertir base64 a File
      const base64Response = await fetch(avatarTransformed.url);
      const processedBlob = await base64Response.blob();
      const fileName = `${userId}_${Date.now()}.jpg`;
      const processedFile = new File([processedBlob], fileName, { type: 'image/jpeg' });
      const filePath = `avatars/${fileName}`;
      
      // Verificar tamaño final
      const finalSizeKB = Math.round(processedBlob.size/1024);
      if (process.env.NODE_ENV === 'development') {
        console.log('[uploadAvatar] fileName:', fileName, 'fileType:', processedFile.type, 'size:', finalSizeKB + 'KB');
      }
      
      if (finalSizeKB > 300) {
        console.warn(`[uploadAvatar] La imagen sigue siendo grande (${finalSizeKB}KB > 300KB)`);
      }
      
      // Sube el archivo a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        return null;
      }

      // Obtiene la URL pública del archivo subido
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return data?.publicUrl || null;
    } catch (error) {
      console.error('Error en el procesamiento de avatar:', error);
      return null;
    }
  }

  // Suscripción a cambios en Centros de Movilizaciòn
  useEffect(() => {
    if (!user?.id) return;

    const pointsSubscription = supabase
      .channel('concentration_points_general')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concentration_points' }, payload => {
        console.log('Evento general en Centros de Movilizaciòn:', payload);
        // Actualizar estado o lógica según sea necesario
      })
      .subscribe();

    // Cleanup de las suscripciones al desmontar el componente
    return () => {
      supabase.removeChannel(pointsSubscription);
    };
  }, [user?.id]);

  // --- Estado para verificar si está asociado a un punto colectivo ---
  const [isAssociatedToCollectivePoint, setIsAssociatedToCollectivePoint] = useState<boolean>(false);
  const [collectivePointInfo, setCollectivePointInfo] = useState<{ address: string; institutionalName: string } | null>(null);

  // --- Verificar si el Dirigente está asociado a un punto colectivo ---
  useEffect(() => {
    async function checkCollectivePointAssociation() {
      if (!user?.id || !user?.address) {
        setIsAssociatedToCollectivePoint(false);
        setCollectivePointInfo(null);
        return;
      }

      // Buscar si existe un punto colectivo con la misma dirección del usuario
      const { data: collectivePoint, error } = await supabase
        .from('concentration_points')
        .select(`
          id, 
          address, 
          type,
          profiles!concentration_points_user_id_fkey(name)
        `)
        .eq('address', user.address)
        .eq('type', 'colective_point')
        .single();

      if (!error && collectivePoint) {
        setIsAssociatedToCollectivePoint(true);
        const profileData = Array.isArray(collectivePoint.profiles) 
          ? collectivePoint.profiles[0] 
          : collectivePoint.profiles;
        setCollectivePointInfo({
          address: collectivePoint.address,
          institutionalName: profileData?.name || 'Institución'
        });
      } else {
        setIsAssociatedToCollectivePoint(false);
        setCollectivePointInfo(null);
      }
    }

    checkCollectivePointAssociation();
  }, [user]);

  // Función para subir imagen de header a Supabase Storage
  const uploadHeaderImage = async (file: File, userId: string): Promise<{ url: string | null, error: string | null }> => {
    if (!file || !userId) return { url: null, error: 'Archivo o usuario no válido' };
    
    try {
      // Paso 1: Procesar la imagen para asegurar que no exceda los 800 KB
      if (process.env.NODE_ENV === 'development') {
        console.log('[uploadHeaderImage] Procesando imagen con límite de 800KB');
      }
      const processedBase64 = await prepareImageForUpload(file, 800); // 800 KB máximo
      if (!processedBase64) {
        return { url: null, error: 'No se pudo procesar la imagen' };
      }
      
      // Paso 2: Aplicar transformaciones adicionales para la imagen de cabecera
      const headerTransformed = await transformImage(processedBase64, {
        width: 1200, // Ancho recomendado para cabeceras
        height: 400, // Alto recomendado para cabeceras
        quality: 70,  // Calidad ajustada para mantener bajo los 800KB
        format: 'jpeg',
        name: 'header-image'
      });
      
      if (!headerTransformed.success) {
        return { url: null, error: 'Error al aplicar transformaciones a la imagen' };
      }
      
      // Convertir el base64 procesado a File
      const base64Response = await fetch(headerTransformed.url);
      const processedBlob = await base64Response.blob();
      const fileName = `${userId}_${Date.now()}.jpg`;
      const processedFile = new File([processedBlob], fileName, { type: 'image/jpeg' });
      
      // Verificar tamaño final
      const finalSizeKB = Math.round(processedBlob.size/1024);
      if (process.env.NODE_ENV === 'development') {
        console.log('[uploadHeaderImage] fileName:', fileName, 'fileType:', processedFile.type, 'size:', finalSizeKB + 'KB');
      }
      
      if (finalSizeKB > 800) {
        console.warn(`[uploadHeaderImage] La imagen sigue siendo grande (${finalSizeKB}KB > 800KB)`);
      }
      
      const { error: uploadError } = await supabase.storage
        .from('header-img')
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('[uploadHeaderImage] Error al subir:', uploadError);
        return { url: null, error: 'Error al subir la imagen: ' + (uploadError.message || JSON.stringify(uploadError)) };
      }
      
      // Obtiene la URL pública del archivo subido
      const { data } = supabase.storage.from('header-img').getPublicUrl(fileName);
      if (process.env.NODE_ENV === 'development') {
        console.log('[uploadHeaderImage] URL pública:', data?.publicUrl);
      }
      return { url: data?.publicUrl || null, error: null };
    } catch (error) {
      console.error('[uploadHeaderImage] Error inesperado:', error);
      return { url: null, error: 'Error inesperado al procesar o subir la imagen' };
    }
  };

  // Función para reproducir sonido de notificación (opcional)
  const playNotificationSound = () => {
    try {
      // Solo reproducir sonido si el documento está visible (pestaña activa)
      if (document.visibilityState === 'visible') {
        const audio = new Audio('/assets/alarma econecta.mp3');
        audio.volume = 0.3; // Volumen moderado
        audio.play().catch(() => {
          // Fallar silenciosamente si no se puede reproducir
        });
      }
    } catch {
      // Fallar silenciosamente si hay problemas con el audio
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-2">
      {/* Mostrar mensaje de error si existe */}
      {error && (
        <div className="mb-4 w-full max-w-2xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {/* Mostrar mensaje de éxito si existe */}
      {/* Header grande y editable */}
      <div className="w-full flex flex-col items-center justify-center bg-white shadow rounded-t-3xl px-8 py-8 mb-8 max-w-3xl relative animate-fade-in" style={{ minHeight: '260px', position: 'relative' }}>
        <div className="absolute top-4 right-4 z-20">
          {/* Botón para cambiar imagen del header */}
          <button
            onClick={() => setShowHeaderImageModal(true)}
            className="cursor-pointer bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 transition-all text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 19.5V7.125c0-.621.504-1.125 1.125-1.125h3.38c.414 0 .788-.252.94-.639l.57-1.522A1.125 1.125 0 018.21 3.75h7.58c.482 0 .915.304 1.07.764l.57 1.522c.152.387.526.639.94.639h3.38c.621 0 1.125.504 1.125 1.125V19.5a1.125 1.125 0 01-1.125 1.125H3.375A1.125 1.125 0 012.25 19.5z" />
              <circle cx="12" cy="13.5" r="3.75" />
            </svg>
            imagen
          </button>
        </div>
        {/* Imagen de cabecera grande */}
        <div className="w-full h-40 md:h-56 rounded-2xl overflow-hidden flex items-center justify-center bg-blue-100 border-2 border-blue-300 mb-4 relative" style={{ minHeight: '160px', maxHeight: '220px' }}>
          <img
            src={user?.header_image_url || '/assets/logo%20cm%20pj.png'}
            alt="Imagen de cabecera"
            className="w-full h-full object-cover object-center"
            style={{ minHeight: '160px', maxHeight: '220px' }}
          />
          {/* Foto de perfil sobrepuesta */}
          <div className="absolute left-6 bottom-24 translate-y-1/2 w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
            <img
              src={getAvatarUrl(user?.avatar_url, user?.name)}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center w-full mt-8">
          <h2 className="text-3xl font-extrabold text-blue-700 mb-1">{user?.name || 'Dirigente'}</h2>
          <p className="text-gray-500 capitalize text-lg">{user?.type === 'resident' ? 'Dirigente' : user?.type || 'Usuario'}</p>
          {/* Etiqueta de asociación a punto colectivo */}
          {isAssociatedToCollectivePoint && collectivePointInfo && (
            <div className="mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Asociado a punto colectivo
              </span>
              <p className="text-xs text-gray-600 mt-1">
                Gestionado por: {collectivePointInfo.institutionalName}
              </p>
            </div>
          )}
        </div>
      </div>
      <Link to="/collection-points" className="block px-6 py-4 rounded-md font-bold text-blue-700 hover:bg-blue-700 hover:text-white">
        <img
          src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1747796657/icon_map.mp4_uphkzx.gif"
          alt="Mapa"
          className="inline-block w-15 h-12 mr-4 rounded-md align-middle"
          style={{ verticalAlign: 'middle' }}
        />
        Centros de Movilizaciòn ( Global )
      </Link>

      {/* Separador visual */}
      <div className="my-6 w-full max-w-4xl">
        <hr className="border-t-2 border-blue-100" />
      </div>

      <div
        className="flex flex-wrap md:flex-nowrap gap-2 md:gap-1 mb-10 overflow-x-auto scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent px-3 md:px-8"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
          <button
            className={`flex-1 min-w-[140px] md:min-w-0 px-4 py-2 rounded-xl font-semibold transition-all duration-200 relative text-center whitespace-nowrap flex items-center justify-center gap-2 border-2
              ${activeTab === 'puntos'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_0_rgba(34,197,94,0.25),0_1.5px_0_0_#059669_inset] border-blue-700 ring-2 ring-blue-300/40 scale-105 active-tab-effect'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100 shadow-[0_2px_8px_0_rgba(0,0,0,0.10),0_1.5px_0_0_#e5e7eb_inset] border-gray-300 hover:shadow-[0_4px_16px_0_rgba(34,197,94,0.10),0_1.5px_0_0_#bbf7d0_inset]'}
            `}
            onClick={() => setActiveTab('puntos')}
          >
            <FaMapMarkerAlt className="w-5 h-5" />
            Mis Puntos
          </button>
          <button
            className={`flex-1 min-w-[140px] md:min-w-0 px-4 py-2 rounded-xl font-semibold transition-all duration-200 relative text-center whitespace-nowrap flex items-center justify-center gap-2 border-2
              ${activeTab === 'Dirigentes'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_0_rgba(34,197,94,0.25),0_1.5px_0_0_#059669_inset] border-blue-700 ring-2 ring-blue-300/40 scale-105 active-tab-effect'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100 shadow-[0_2px_8px_0_rgba(0,0,0,0.10),0_1.5px_0_0_#e5e7eb_inset] border-gray-300 hover:shadow-[0_4px_16px_0_rgba(34,197,94,0.10),0_1.5px_0_0_#bbf7d0_inset]'}
            `}
            onClick={() => setActiveTab('Dirigentes')}
          >
            <FaRecycle className="w-5 h-5" />
            Dirigentes
            {/* Badge rojo si hay mensajes no leídos */}
            {Object.values(unreadMessagesByRecycler).some(count => count > 0) && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold shadow-lg border-2 border-white animate-pulse z-10">
                ●
              </span>
            )}
          </button>
          <button
            className={`flex-1 min-w-[140px] md:min-w-0 px-4 py-2 rounded-xl font-semibold transition-all duration-200 relative text-center whitespace-nowrap flex items-center justify-center gap-2 border-2
              ${activeTab === 'perfil'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_0_rgba(34,197,94,0.25),0_1.5px_0_0_#059669_inset] border-blue-700 ring-2 ring-blue-300/40 scale-105 active-tab-effect'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100 shadow-[0_2px_8px_0_rgba(0,0,0,0.10),0_1.5px_0_0_#e5e7eb_inset] border-gray-300 hover:shadow-[0_4px_16px_0_rgba(34,197,94,0.10),0_1.5px_0_0_#bbf7d0_inset]'}
            `}
            onClick={() => setActiveTab('perfil')}
          >
            <FaUserCircle className="w-5 h-5" />
            Mi Perfil
          </button>
          <button
            className={`flex-1 min-w-[140px] md:min-w-0 px-4 py-2 rounded-xl font-semibold transition-all duration-200 relative text-center whitespace-nowrap flex items-center justify-center gap-2 border-2
              ${activeTab === 'ecocuenta'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_0_rgba(34,197,94,0.25),0_1.5px_0_0_#059669_inset] border-blue-700 ring-2 ring-blue-300/40 scale-105 active-tab-effect'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100 shadow-[0_2px_8px_0_rgba(0,0,0,0.10),0_1.5px_0_0_#e5e7eb_inset] border-gray-300 hover:shadow-[0_4px_16px_0_rgba(34,197,94,0.10),0_1.5px_0_0_#bbf7d0_inset]'}
            `}
            onClick={() => setActiveTab('ecocuenta')}
          >
            <FaWallet className="w-5 h-5" />
            EcoCuenta
          </button>
          <button
            className={`flex-1 min-w-[140px] md:min-w-0 px-4 py-2 rounded-xl font-semibold transition-all duration-200 relative text-center whitespace-nowrap flex items-center justify-center gap-2 border-2
              ${activeTab === 'historial'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_0_rgba(34,197,94,0.25),0_1.5px_0_0_#059669_inset] border-blue-700 ring-2 ring-blue-300/40 scale-105 active-tab-effect'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100 shadow-[0_2px_8px_0_rgba(0,0,0,0.10),0_1.5px_0_0_#e5e7eb_inset] border-gray-300 hover:shadow-[0_4px_16px_0_rgba(34,197,94,0.10),0_1.5px_0_0_#bbf7d0_inset]'}
            `}
            onClick={() => setActiveTab('historial')}
          >
            <FaHistory className="w-5 h-5" />
            Historial
          </button>
          <button
            className={`flex-1 min-w-[140px] md:min-w-0 px-4 py-2 rounded-xl font-semibold transition-all duration-200 relative text-center whitespace-nowrap flex items-center justify-center gap-2 border-2
              ${activeTab === 'mensajes'
                ? 'bg-blue-600 text-white shadow-[0_4px_16px_0_rgba(34,197,94,0.25),0_1.5px_0_0_#059669_inset] border-blue-700 ring-2 ring-blue-300/40 scale-105 active-tab-effect'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100 shadow-[0_2px_8px_0_rgba(0,0,0,0.10),0_1.5px_0_0_#e5e7eb_inset] border-gray-300 hover:shadow-[0_4px_16px_0_rgba(34,197,94,0.10),0_1.5px_0_0_#bbf7d0_inset]'}
            `}
            onClick={() => setActiveTab('mensajes')}
          >
            <FaEnvelope className="w-5 h-5" />
            Mensajes
            {Object.values(unreadMessagesByRecycler).some(c => c > 0) && (
              <span className="absolute -top-1 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {Object.values(unreadMessagesByRecycler).reduce((s, v) => s + (v || 0), 0)}
              </span>
            )}
          </button>
        </div>
      {activeTab === 'puntos' && (
        <div className="w-full max-w-4xl">
          <div className="mb-4 flex flex-wrap gap-2 justify-center md:justify-start">
            <button
              onClick={() => setActivePointsTab('todos')}
              className={`px-3 py-1 rounded mb-2 md:mb-0 min-w-[120px] text-sm font-semibold transition-all
                ${activePointsTab==='todos' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            >
              Disponibles
              {puntosTodos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-800 text-white rounded-full">
                  {puntosTodos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActivePointsTab('reclamados')}
              className={`px-3 py-1 rounded mb-2 md:mb-0 min-w-[120px] text-sm font-semibold transition-all relative
                ${activePointsTab==='reclamados' ? 'bg-yellow-400 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
            >
              Puntos reclamados
              {puntosReclamados.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-600 text-white rounded-full animate-pulse">
                  {puntosReclamados.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActivePointsTab('demorados')}
              className={`px-3 py-1 rounded mb-2 md:mb-0 min-w-[120px] text-sm font-semibold transition-all
                ${activePointsTab==='demorados' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              Puntos demorados
              {puntosDemorados.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full animate-pulse">
                  {puntosDemorados.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActivePointsTab('retirados')}
              className={`px-3 py-1 rounded mb-2 md:mb-0 min-w-[120px] text-sm font-semibold transition-all
                ${activePointsTab==='retirados' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
            >
              Puntos retirados
              {puntosRetirados.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                  {puntosRetirados.length}
                </span>
              )}
            </button>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Mis Centros de Movilizaciòn</h2>
              {isUpdatingRealtime && (
                <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold animate-fade-in">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  Sincronizando datos...
                </div>
              )}
            </div>
            {/* Enlace para Agregar centro: elimina el paso de función por state */}
            <Link
              to="/add-collection-point"
              className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 focus:ring-4 focus:ring-blue-400 focus:outline-none shadow-xl transition-all duration-300 w-fit mb-4 group animate-bounce animate-delay-500 animate-once animate-ease-in-out animate-fill-both animate-fast animate-important border-2 border-blue-400 scale-105 hover:scale-110 ring-4 ring-blue-300/40 hover:ring-blue-500/60"
              style={{ minWidth: 'unset', maxWidth: '220px', boxShadow: '0 0 0 4px #bbf7d0, 0 8px 24px 0 rgba(34,197,94,0.15)' }}
            >
              <FaPlus className="h-4 w-4 mr-1 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold tracking-wide text-base animate-pulse">Agregar centro</span>
            </Link>
            <div className="mt-4">
                  {(() => {
                    // Filtrar según activePointsTab
                    let list = detailedPoints;
                    if (activePointsTab === 'disponibles') list = puntosTodos;
                    else if (activePointsTab === 'reclamados') list = puntosReclamados;
                    else if (activePointsTab === 'demorados') list = puntosDemorados;
                    else if (activePointsTab === 'retirados') list = puntosRetirados;

                    if (!list || list.length === 0) {
                      return <p className="text-sm text-gray-600">No tienes centros registrados aún.</p>;
                    }

                    return (
                      <ul className="space-y-4">
                        {list.map((p) => (
                          <li key={p.id} className="flex items-start gap-4 p-3 border rounded-lg">
                            <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                              {p.photo_url ? (
                                <img src={p.photo_url} alt="foto" className="object-cover w-full h-full" />
                              ) : (
                                <FaMapMarkerAlt className="text-gray-400 w-8 h-8" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-lg font-semibold">{p.address}</div>
                                  <div className="text-sm text-gray-500">Tipo: {p.type || 'individual'}</div>
                                </div>
                                <div className="text-sm">
                                  <span className={`px-2 py-1 rounded-full text-xs ${p.status === 'available' ? 'bg-green-100 text-green-800' : p.status === 'claimed' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>
                                    {p.status || 'unknown'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (p.lat && p.lng) {
                                      setMapFitBounds([[Number(p.lng), Number(p.lat)], [Number(p.lng), Number(p.lat)]]);
                                      setMapCenterToUser(false);
                                    }
                                  }}
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  Ver en el mapa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePoint(p)}
                                  className="text-sm text-red-600 hover:underline"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
            </div>
                  {(() => {
                    let pointsToShow = puntosTodos;
                    if (activePointsTab === 'reclamados') pointsToShow = puntosReclamados;
                    if (activePointsTab === 'demorados') pointsToShow = puntosDemorados;
                    if (activePointsTab === 'retirados') pointsToShow = puntosRetirados;
                    if (pointsToShow.length === 0) return <p className="text-gray-500">No hay puntos en esta categoría.</p>;
                    return (
                      <ul className="space-y-4">
                        {pointsToShow.map((point) => {
                          // Determinar si el punto debe verse apagado
                          let isInactive = false;
                          if (activePointsTab === 'todos') {
                            isInactive = point.status === 'completed';
                          } else if (activePointsTab === 'reclamados' || activePointsTab === 'demorados') {
                            isInactive = false;
                          }

                    return (
                      <li
                        key={point.id}
                        className={`border rounded-lg p-4 flex flex-col md:flex-row md:items-center relative bg-white shadow-md transition-all duration-300 ease-in-out hover:scale-[1.025] hover:shadow-2xl group animate-fade-in ${isInactive ? 'opacity-80 grayscale-[0.2] pointer-events-none' : ''}`}
                        style={{ animation: 'fadeInUp 0.7s' }}
                      >
                        <div className="flex-1 mb-2 md:mb-0">
                          <div className="flex items-center gap-2 mb-1">
                            <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png" alt="Punto de Recolección" className={`w-12 h-12 ${isInactive ? 'grayscale' : ''}`} />
                            <h3 className="text-lg font-semibold whitespace-normal break-words">{point.address}</h3>
                            {/* Etiqueta de estado */}
                            {activePointsTab === 'todos' && (!point.status || point.status === 'available') && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300">Disponible</span>
                            )}
                            {point.status === 'completed' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300">Retirado</span>
                            )}
                            {activePointsTab === 'retirados' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold border border-purple-300">
                               Rating 
                              </span>
                            )}
                            {activePointsTab==='demorados' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold border border-red-300">Demorado</span>
                            )}
                          </div>
                          <p className="text-gray-500"><FaMapPin className="inline-block w-4 h-4 mr-1" />{point.district}</p>
                          <p className="text-gray-500"><FaCalendarAlt className="inline-block w-4 h-4 mr-1" />
                            {(() => {
                              if (typeof point.schedule === 'string') {
                                const dias = [
                                  { en: 'Monday', es: 'Lunes' },
                                  { en: 'Tuesday', es: 'Martes' },
                                  { en: 'Wednesday', es: 'Miércoles' },
                                  { en: 'Thursday', es: 'Jueves' },
                                  { en: 'Friday', es: 'Viernes' },
                                  { en: 'Saturday', es: 'Sábado' },
                                  { en: 'Sunday', es: 'Domingo' },
                                  { en: 'Mondays', es: 'Lunes' },
                                  { en: 'Tuesdays', es: 'Martes' },
                                  { en: 'Wednesdays', es: 'Miércoles' },
                                  { en: 'Thursdays', es: 'Jueves' },
                                  { en: 'Fridays', es: 'Viernes' },
                                  { en: 'Saturdays', es: 'Sábado' },
                                  { en: 'Sundays', es: 'Domingo' },
                                ];
                                let texto = point.schedule;
                                dias.forEach(d => {
                                  texto = texto.replace(new RegExp(`\\b${d.en}\\b`, 'g'), d.es);
                                });
                                return texto;
                              }
                              return point.schedule;
                            })()}
                          </p>
                          {/* Mostrar notas adicionales si existen */}
                          {point.notas && (<p className="text-gray-600 mt-2 text-sm"><b>Notas adicionales:</b> {point.notas}</p>)}
                          {point.additional_info && (<p className="text-gray-600 mt-2 text-sm"><b>Información adicional:</b> {point.additional_info}</p>)}
                        </div>
                        {/* Imagen del material o imagen por defecto */}
                        <div className="flex-shrink-0 flex margin rigth items-center md:ml-6 mt-4 md:mt-0">
                          <div className={`relative transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-blue-300 hover:shadow-lg rounded-lg ${isInactive ? 'grayscale' : ''}`}> 
                            <img
                              src={point.photo_url || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png"}
                              alt={point.photo_url ? "Foto del material" : "Punto de Recolección"}
                              className={`w-40 h-28 object-cover rounded-lg shadow-md border border-blue-200 ${isInactive ? 'grayscale' : ''}`}
                              style={{ background: '#f0fdf4' }}
                              onError={(e) => {
                                // Si la imagen del material falla, usar la imagen por defecto
                                const target = e.target as HTMLImageElement;
                                target.src = "https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png";
                                target.className = target.className.replace('object-cover', 'object-contain');
                              }}
                            />
                            {/* Lower third con etiquetas de materiales */}
                            {point.materials && point.materials.length > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-lg p-2">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {point.materials.slice(0, 2).map((material, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-2 py-0.2 bg-blue-500/90 text-white text-xs font-bold rounded-full shadow-lg backdrop-blur-sm border border-white/40"
                                      style={{ fontSize: '9px' }}
                                    >
                                      {material}
                                    </span>
                                  ))}
                                  {point.materials.length > 2 && (
                                    <span
                                      className="inline-block px-2 py-1 bg-blue-600/90 text-white text-xs font-bold rounded-full shadow-lg backdrop-blur-sm border border-white/20"
                                      style={{ fontSize: '10px' }}
                                      title={`+${point.materials.length - 2} materiales más: ${point.materials.slice(2).join(', ')}`}
                                    >
                                      +{point.materials.length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Indicador de foto del material */}
                            {point.photo_url && (
                              <div className="absolute top-2 right-2">
                                <div className="bg-blue-500/80 text-white p-1 rounded-full shadow-lg backdrop-blur-sm border border-white/20" title="Foto del material">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Contenedor de botones de acción - Responsive y organizado */}
                        <div className="w-full md:w-auto mt-4 md:mt-0 md:ml-4">
                          <div className="flex flex-col gap-2">
                            {/* Botón para volver a disponible solo en tab demorados */}
                            {activePointsTab === 'demorados' && (
                              <button
                                onClick={() => handleMakeAvailableAgain(point)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md animate-bounce w-full md:w-auto text-sm font-semibold"
                              >
                                ✅ Disponible
                              </button>
                            )}
                            
                            {/* Botones para puntos retirados: Volver a disponible, Calificar y Donar */}
                            {activePointsTab === 'retirados' && (
                              <>
                                <button
                                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md w-full text-sm font-semibold flex items-center justify-center gap-2"
                                  onClick={() => handleMakeAvailableAgain(point)}
                                  type="button"
                                >
                                  🔄 Volver a disponible
                                </button>
                                
                                {/* Siempre mostrar botones de calificar y donar en puntos retirados */}
                                {(() => {
                                  // Mostrar botones de calificar/donar solo si hay claim_id o recycler info en el punto
                                  const pt = point as unknown as Record<string, unknown>;
                                  const recyclerId = String(pt.claim_id || pt.recycler_id || '');
                                  const recyclerName = String(pt.recycler_name || 'Reciclador');
                                  const avatarUrl = pt.recycler_avatar ? String(pt.recycler_avatar) : undefined;

                                  if (!recyclerId) return null;

                                  return (
                                    <>
                                      <button
                                        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 shadow-md w-full text-sm font-semibold flex items-center justify-center gap-2"
                                        onClick={() => {
                                          if (recyclerId) {
                                            setRatingTarget({ recyclerId: recyclerId as string, recyclerName: recyclerName as string, avatarUrl });
                                          } else {
                                            toast.error('No se pudo encontrar información del reciclador para calificar');
                                          }
                                        }}
                                        type="button"
                                      >
                                        <FaStar className="w-4 h-4" />
                                        Calificar reciclador
                                      </button>
                                      <button
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md w-full text-sm font-semibold flex items-center justify-center gap-2"
                                        onClick={() => {
                                          if (recyclerId) {
                                            setShowDonationModal({
                                              recyclerId: recyclerId as string,
                                              recyclerName: recyclerName as string,
                                              avatarUrl,
                                              alias: ''
                                            });
                                          } else {
                                            toast.error('No se pudo encontrar información del reciclador para donar');
                                          }
                                        }}
                                        type="button"
                                      >
                                        💝 Donar
                                      </button>
                                    </>
                                  );
                                })()}
                              </>
                            )}
                            
                            {/* Botón eliminar SOLO se muestra si el punto está disponible (no reclamado ni retirado) */}
                            {( !point.claim_id && point.status !== 'completed') && (
                              <button
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow-md w-full md:w-auto text-sm font-semibold flex items-center justify-center gap-2"
                                onClick={() => handleDeletePoint(point)}
                                type="button"
                              >
                                <FaTimes className="w-4 h-4" />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
      })}
    </ul>
  );
})()}
          </div>
        </div>
      )}
      {activeTab === 'Dirigentes' && (
        <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
          {/* Mapa colocado arriba de las cards de Dirigentes */}
          <div id="resident-recyclers-map" className="w-full mb-6 rounded-lg overflow-hidden" style={{ height: '480px' }}>
            <Map
              markers={recyclers.filter(r => r.role === 'recycler' && r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number' && !isNaN(r.lat) && !isNaN(r.lng)).map(r => ({
                id: r.id,
                lat: r.lat as number,
                lng: r.lng as number,
                title: r.profiles?.name || 'Reciclador',
                avatar_url: r.profiles?.avatar_url,
                role: r.role,
                online: !!r.online
              }))}
              fitBounds={mapFitBounds}
              centerToUser={mapCenterToUser}
            />
          </div>
          <div className="flex justify-center mb-4">
            <button
              type="button"
              className="px-4 py-2 rounded-full bg-blue-600 text-white font-semibold shadow-md border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 text-sm flex items-center gap-2"
              onClick={() => {
                // Scroll al mapa
                const el = document.getElementById('resident-recyclers-map');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Preparar fitBounds si hay Dirigentes con coords, sino centrar en la posición del usuario
                const points = recyclers.filter(r => r.role === 'recycler' && r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number' && !isNaN(r.lat) && !isNaN(r.lng));
                if (points.length > 0) {
                  // calcular min/max de lat/lng
                  const lats = points.map(p => p.lat as number);
                  const lngs = points.map(p => p.lng as number);
                  const minLat = Math.min(...lats);
                  const maxLat = Math.max(...lats);
                  const minLng = Math.min(...lngs);
                  const maxLng = Math.max(...lngs);
                  // add small padding
                  const padLat = (maxLat - minLat) * 0.2 || 0.01;
                  const padLng = (maxLng - minLng) * 0.2 || 0.01;
                  const sw: [number, number] = [minLng - padLng, minLat - padLat];
                  const ne: [number, number] = [maxLng + padLng, maxLat + padLat];
                  setMapFitBounds([sw, ne]);
                  // Resetear el flag tras un corto delay para permitir nuevas acciones futuras
                  setTimeout(() => setMapFitBounds(null), 1500);
                } else {
                  // No hay Dirigentes con coords -> centrar en la ubicación del usuario
                  setMapCenterToUser(true);
                  setTimeout(() => setMapCenterToUser(false), 1500);
                }
              }}
            >
              <FaMapMarkerAlt className="w-4 h-4" />
              <FaRecycle className="w-4 h-4" />
              Ver Dirigentes en el mapa
            </button>
          </div>
          <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center gap-2"><FaRecycle className="w-6 h-6 text-blue-600" />Dirigentes</h2>
          {recyclers.filter(r => r.role === 'recycler' && r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number' && !isNaN(r.lat) && !isNaN(r.lng)).length === 0 ? (
            <p className="text-gray-500 text-center">No hay Dirigentes en línea con ubicación disponible.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recyclers.filter(r => r.role === 'recycler' && r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number' && !isNaN(r.lat) && !isNaN(r.lng)).map((rec) => (
                <div key={rec.id} className="border rounded-lg p-4 flex flex-col items-center bg-gray-50 shadow-sm relative">
                  {/* Badge rojo en la tarjeta si hay mensajes no leídos de este reciclador */}
                  {rec.user_id && unreadMessagesByRecycler[rec.user_id] > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold shadow-lg border-2 border-white animate-pulse z-10">
                      ●
                    </span>
                  )}
                  <div className="w-20 h-20 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-blue-600">
                    <img src={getAvatarUrl(rec.profiles?.avatar_url, rec.profiles?.name, '22c55e', 'fff')} 
                         alt="Foto de perfil" 
                         className="w-full h-full object-cover" />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-700 mb-1 flex items-center gap-2">
                    {rec.profiles?.name || 'Reciclador'}
                    {/* Badge de mensajes no leídos */}
                    {unreadMessagesByRecycler[rec.user_id || ''] > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {unreadMessagesByRecycler[rec.user_id || '']}
                      </span>
                    )}
                  </h3>
                  {/* Mostrar promedio de calificaciones y cantidad, ahora clickable para abrir el modal de calificaciones del reciclador */}
                  <button
                    type="button"
                    className="flex items-center gap-2 mb-2 focus:outline-none hover:bg-yellow-50 rounded px-2 py-1 transition"
                    title="Ver calificaciones de este reciclador"
                    onClick={() => {/* ratings removed */}}
                  >
                    <span className="flex items-center">
                      <FaStar className="h-5 w-5 text-yellow-400 mr-1" />
                      <span className="font-semibold text-gray-700 text-base">
                        {typeof rec.rating_average === 'number' ? rec.rating_average.toFixed(1) : 'N/A'}
                      </span>
                    </span>
                    <span className="text-gray-500 text-sm">({rec.total_ratings || 0})</span>
                  </button>
                  {/* Mostrar email y teléfono si existen */}
                  {rec.profiles?.email && (
                    <p className="text-gray-500 text-sm mb-1 flex items-center"><FaEnvelope className="h-4 w-4 mr-1" />{rec.profiles.email}</p>
                  )}
                  {rec.profiles?.phone && (
                    <p className="text-gray-500 text-sm mb-1 flex items-center"><FaPhone className="h-4 w-4 mr-1" />{rec.profiles.phone}</p>
                  )}
                  {rec.profiles?.dni && (
                    <p className="text-gray-500 text-sm mb-1 flex items-center"><span className="font-semibold mr-2">DNI:</span>{rec.profiles.dni}</p>
                  )}
                  {rec.bio && <p className="text-gray-600 text-xs mt-2 text-center">{rec.bio}</p>}
                  {/* Validación de UUID para el chat */}
                  {rec.user_id && /^[0-9a-fA-F-]{36}$/.test(rec.user_id) ? (
                    <Link
                      to={`/chat/${rec.user_id}`}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none relative"
                      onClick={() => clearUnreadForRecycler(rec.user_id!)}
                    >
                      Enviar mensaje
                      {/* Badge rojo SOLO en el botón, persiste hasta abrir el chat */}
                      {unreadMessagesByRecycler[rec.user_id || ''] > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white animate-pulse z-10">
                          {unreadMessagesByRecycler[rec.user_id || '']}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <button
                      className="mt-3 px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed opacity-60"
                      disabled
                      title="Este reciclador no tiene chat disponible."
                    >
                      Chat no disponible
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Mapa ya renderizado arriba; bloque duplicado eliminado */}
        </div>
      )}
      {activeTab === 'mensajes' && (
        <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-center">Mensajes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ChatList
                chats={chatPreviews.map(c => ({
                  userId: c.userId,
                  name: c.name,
                  avatar_url: c.avatar_url,
                  lastMessage: c.lastMessage ? { content: c.lastMessage.content, created_at: c.lastMessage.created_at } : undefined,
                  unreadCount: c.unreadCount || 0,
                }))}
                onChatSelect={(otherUserId) => {
                  // Limpiar badge para ese reciclador
                  clearUnreadForRecycler(otherUserId);
                  // Navegar al chat
                  navigate(`/chat/${otherUserId}`);
                }}
              />
            </div>
            <div className="hidden md:block p-4 border rounded-lg bg-gray-50">
              <p className="text-gray-500">Selecciona una conversación para abrir el chat. Los Dirigentes pueden enviarte mensajes desde puntos reclamados.</p>
            </div>
          </div>
        </div>
      )}
      {/* Sección Mi EcoCuenta (movida al tab ecocuenta) */}
      {activeTab === 'ecocuenta' && (
        <div className="w-full max-w-2xl bg-gradient-to-br from-blue-50 via-emerald-100 to-blue-200 shadow-xl rounded-3xl p-8 flex flex-col items-center mb-8 relative overflow-hidden animate-fade-in">
          {/* Animación de confeti al ganar recompensa */}
          {ecoRewardVisible && ecoReward && (
            <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1749495577/6ob_mwjq0t.gif" alt="Confeti" className="absolute top-0 left-0 w-full h-32 object-cover pointer-events-none animate-bounce-in" style={{zIndex:1}} />
          )}
          <h2 className="text-3xl font-extrabold mb-4 text-blue-700 drop-shadow-lg flex items-center gap-2 animate-bounce-in">
            <svg className="w-8 h-8 text-emerald-500 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" stroke="currentColor" fill="none" /><path d="M12 6v6l4 2" strokeWidth="2" stroke="currentColor" fill="none" /></svg>
            Mi EcoCuenta
          </h2>
          <div className="flex flex-col items-center gap-2 w-full">
            <span className="text-6xl font-extrabold text-blue-600 drop-shadow-lg animate-grow">{ecoCreditos}</span>
            <span className="text-gray-700 font-semibold text-lg tracking-wide">EcoCreditos acumulados</span>
            {/* Barra de progreso visual */}
            <div className="w-full max-w-xs mt-4 mb-2">
              <div className="h-4 bg-blue-200 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-blue-400 to-emerald-500 transition-all duration-700" style={{ width: `${Math.min(ecoCreditos, 50) * 2}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-blue-700 font-bold mt-1">
                <span>0</span>
                <span>50</span>
              </div>
            </div>
            {/* Mensaje de recompensa o motivación */}
            {ecoRewardVisible && ecoReward ? (
              <div className="mt-4 px-6 py-3 bg-emerald-100 border-2 border-emerald-400 text-emerald-800 rounded-xl shadow-lg animate-bounce-in text-center text-lg font-bold flex items-center gap-2">
                <svg className="w-7 h-7 text-emerald-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>
                {ecoReward}
              </div>
            ) : (
              <div className="mt-4 text-gray-500 text-base animate-fade-in">¡Sigue reciclando! Acumula {50 * (Math.floor(ecoCreditos / 50) + 1)} EcoCreditos para tu recompensa.</div>
            )}
            {/* Gráfico circular simple */}
            <div className="mt-6 flex flex-col items-center">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="6" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#22c55e" strokeWidth="8" strokeDasharray="339.292" strokeDashoffset="{339.292 - (ecoCreditos/50)*339.292}" style={{transition:'stroke-dashoffset 0.7s'}} />
                <text x="60" y="68" textAnchor="middle" fontSize="2.2em" fill="#16a34a" fontWeight="bold">{ecoCreditos}</text>
              </svg>
              <span className="text-blue-700 font-semibold mt-2">Progreso hacia tu recompensa</span>
            </div>
          </div>
        </div>
      )}
      {/* Sección Mi Perfil (sin duplicar Mi EcoCuenta) */}
      {activeTab === 'perfil' && (
        <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6 flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-6">Mi Perfil</h2>
          
          {/* Avatar actual */}
          <div className="mb-6 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-300 shadow-lg mb-4">
              <img
                src={getAvatarUrl(user?.avatar_url, user?.name)}
                alt="Foto de perfil actual"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Foto de perfil actual
            </p>
          </div>
          
          <form
            className="flex flex-col items-center w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              // Limpia y valida campos antes de enviar
              // No permitimos editar lat/lng manualmente, pero los mostramos
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({
                    name: editName.trim(),
                    email: editEmail.trim(),
                    phone: editPhone.trim(),
                    address: editAddress.trim(),
                    bio: editBio.trim(),
                    materials: editMaterials.split(',').map((m: string) => m.trim()).filter(Boolean),
                  })
                  .eq('user_id', user!.id);
                if (!error) {
                  toast.success('Perfil actualizado correctamente');
                  // Aseguramos que el objeto pasado a login cumple con el tipo User
                  login({
                    id: user!.id,
                    profileId: user!.profileId || '',
                    name: editName,
                    email: editEmail,
                    phone: editPhone,
                    address: editAddress,
                    bio: editBio,
                    avatar_url: user!.avatar_url,
                    header_image_url: user!.header_image_url, // <-- Mantener imagen de header
                    materials: editMaterials.split(',').map((m: string) => m.trim()).filter(Boolean),
                    lat: user!.lat,
                    lng: user!.lng,
                    online: user!.online,
                    type: user!.type,
                    role: user!.role,
                    user_id: ''
                  });
                } else {
                  toast.error('Error al actualizar el perfil');
                }
              } catch (err) {
                toast.error('Error inesperado al actualizar el perfil');
                console.error(err);
              }
            }}
          >
            {/* Sección para cambiar foto de perfil */}
            <div className="mb-6 w-full">
              <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">
                Cambiar foto de perfil
              </h3>
              <PhotoCapture
              aspectRatio="square"
              onCapture={async file => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                  setError('Solo se permiten imágenes JPG, PNG, GIF o WEBP.');
                  return;
                }
                if (file.size > 300 * 1024) {
                  setError('El archivo debe pesar menos de 300 KB.');
                  return;
                }
                setError(null);
                try {
                  // Subir el avatar y obtener la URL
                  const url = await uploadAvatar(file, user?.id || '');
                  if (!url) {
                    setError('Error al subir la imagen.');
                    return;
                  }
                  // Actualizar el perfil en Supabase
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: url })
                    .eq('user_id', user!.id);
                  if (updateError) {
                    setError('Error al actualizar el perfil con la nueva foto.');
                    return;
                  }
                  // Actualizar el estado local del usuario
                  login({
                    ...user!,
                    avatar_url: url
                  });
                  toast.success('Foto de perfil actualizada correctamente');
                } catch (e) {
                  setError('Error inesperado al subir la foto.');
                  console.error(e);
                }
              }}
              onCancel={() => {}}
            />
            </div>
            
            {/* Formulario de información personal */}
            <div className="w-full flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center border-b border-gray-200 pb-2">
                Información Personal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700" htmlFor="name">Nombre</label>
                  <input
                    type="text"
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700" htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700" htmlFor="phone">Teléfono</label>
                  <input
                    type="text"
                    id="phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700" htmlFor="address">Dirección</label>
                  <input
                    type="text"
                    id="address"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col w-full">
                <label className="text-sm font-medium text-gray-700" htmlFor="bio">Biografía</label>
                <textarea
                  id="bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
              <div className="flex flex-col w-full">
                <label className="text-sm font-medium text-gray-700" htmlFor="materials">Materiales que reciclas</label>
                <input
                  type="text"
                  id="materials"
                  value={editMaterials}
                  onChange={(e) => setEditMaterials(e.target.value)}
                  className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  placeholder="Separados por comas"
                />
              </div>
              <button
                type="submit"
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 focus:outline-none shadow-md transition-all duration-200"
              >
                Actualizar Perfil
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal de calificación de reciclador, SIEMPRE disponible */}
  {/* ratings modals removed */}
      {/* Modal de donación */}
      {showDonationModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full relative">
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
        onClick={() => setShowDonationModal(null)}
      >
        ×
      </button>
      <div className="flex flex-col items-center">
        <img
          src={showDonationModal.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(showDonationModal.recyclerName)}&background=FACC15&color=fff&size=64`}
          alt="Avatar reciclador"
          className="w-16 h-16 rounded-full border-2 border-blue-400 object-cover mb-2"
        />
        <h3 className="text-lg font-bold mb-2">Donar a {showDonationModal.recyclerName}</h3>
        <div className="mb-3 w-full flex flex-col items-center">
          <span className="text-gray-700 text-sm font-semibold">Alias para billetera virtual:</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-gray-100 px-2 py-1 rounded text-blue-700 font-mono select-all" id="alias-donacion">
              {showDonationModal.alias || ""}
            </span>
            {showDonationModal.alias && (
              <button
                className="text-blue-600 hover:text-blue-900 text-xs border px-2 py-1 rounded"
                onClick={() => navigator.clipboard.writeText(showDonationModal.alias || "")}
                type="button"
              >
                Copiar
              </button>
            )}
          </div>
        </div>
        <input
          type="number"
          min={1}
          className="border rounded px-3 py-2 mb-3 w-full text-center"
          placeholder="Monto a donar (EcoCreditos)"
          value={donationAmount > 0 ? donationAmount : ""}
          onChange={e => setDonationAmount(Number(e.target.value))}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full font-semibold"
          disabled={donationAmount <= 0 || donationAmount > ecoCreditos}
          onClick={async () => {
            if (donationAmount <= 0 || donationAmount > ecoCreditos) return;
            setEcoCreditos(prev => prev - donationAmount);
            setShowDonationModal(null);
            setDonationAmount(0);
            toast.success(`¡Has donado ${donationAmount} EcoCreditos a ${showDonationModal.recyclerName}!`);
          }}
        >
          Confirmar donación
        </button>
        <p className="text-xs text-gray-500 mt-2">Tu saldo actual: {ecoCreditos} EcoCreditos</p>
        <div className="mt-4 w-full flex flex-col gap-2">
          <span className="text-gray-600 text-xs mb-1">¿Quieres donar dinero real? Usa el alias en tu billetera favorita:</span>
          <div className="flex flex-wrap gap-2 justify-center">
            <a href="https://www.mercadopago.com.ar/" target="_blank" rel="noopener noreferrer" className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold">Mercado Pago</a>
            <a href="https://www.naranjax.com/" target="_blank" rel="noopener noreferrer" className="bg-orange-500 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-semibold">Naranja X</a>
            <a href="https://www.uala.com.ar/" target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-800 text-white px-3 py-1 rounded text-xs font-semibold">Ualá</a>
            <a href="https://www.personalpay.com.ar/" target="_blank" rel="noopener noreferrer" className="bg-pink-500 hover:bg-pink-700 text-white px-3 py-1 rounded text-xs font-semibold">Personal Pay</a>
          </div>
        </div>
  </div>
    </div>
  </div>
)}
      {activeTab === 'historial' && user?.id && (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          <div className="w-full flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-4 text-blue-700 text-center">Historial de Movimientos</h2>
            <div className="space-y-8 w-full">
              {/* Puntos Creados */}
              <div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2 text-center">Puntos Creados</h3>
                {detailedPoints.length === 0 ? (
                  <p className="text-gray-500 text-center">No has creado puntos aún.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {detailedPoints.map((p) => (
                      <li key={p.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left">
                        <span className="font-medium text-gray-800 text-sm">{p.address}</span>
                        <span className="text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString('es-AR') : ''}</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold ml-2">Creado</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Puntos Reclamados */}
              <div>
                <h3 className="text-lg font-semibold text-yellow-700 mb-2 text-center">Puntos Reclamados</h3>
                {puntosReclamados.length === 0 ? (
                  <p className="text-gray-500 text-center">No tienes puntos reclamados.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {puntosReclamados.map((p) => (
                      <li key={p.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left">
                        <span className="font-medium text-gray-800 text-sm">{p.address}</span>
                        <span className="text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString('es-AR') : ''}</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-semibold ml-2">Reclamado</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Puntos Demorados */}
              <div>
                <h3 className="text-lg font-semibold text-red-700 mb-2 text-center">Puntos Demorados</h3>
                {puntosDemorados.length === 0 ? (
                  <p className="text-gray-500 text-center">No tienes puntos demorados.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {puntosDemorados.map((p) => (
                      <li key={p.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left">
                        <span className="font-medium text-gray-800 text-sm">{p.address}</span>
                        <span className="text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString('es-AR') : ''}</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold ml-2">Demorado</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Puntos Retirados */}
              <div>
                <h3 className="text-lg font-semibold text-purple-700 mb-2 text-center">Puntos Retirados</h3>
                {puntosRetirados.length === 0 ? (
                  <p className="text-gray-500 text-center">No tienes puntos retirados.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {puntosRetirados.map((p) => (
                      <li key={p.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left">
                        <span className="font-medium text-gray-800 text-sm">{p.address}</span>
                        <span className="text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString('es-AR') : ''}</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold ml-2">Retirado</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="w-full mt-10">
           
            <EstadisticasPanel userId={user.id} />
          </div>
        </div>
      )}
      
      {/* Modal para cambiar la imagen de encabezado */}
      {showHeaderImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Cambiar imagen de encabezado</h3>
              <button
                type="button"
                onClick={() => setShowHeaderImageModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <FaTimes className="h-6 w-6" />
              </button>
            </div>
            
            <PhotoCapture
              aspectRatio="16:9"
              onCapture={async file => {
                setError(null);
                try {
                  // Subir la imagen y guardar la URL en el perfil (campo header_image_url)
                  const { url, error: uploadError } = await uploadHeaderImage(file, user?.id || '');
                  if (uploadError || !url) {
                    setError(uploadError || 'Error al subir la imagen.');
                    return;
                  }
                  // Actualizar el perfil en Supabase
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ header_image_url: url })
                    .eq('user_id', user!.id);
                  if (updateError) {
                    setError('Error al actualizar la imagen de cabecera.');
                    return;
                  }
                  // Actualizar el estado local del usuario
                  login({ ...user!, header_image_url: url });
                  setShowHeaderImageModal(false);
                  toast.success('Imagen de cabecera actualizada correctamente');
                } catch {
                  setError('Error inesperado al subir la imagen.');
                }
              }}
              onCancel={() => setShowHeaderImageModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardResident;



