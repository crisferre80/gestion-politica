import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaMapMarkerAlt, FaUserCircle, FaHistory, FaPlus, FaEnvelope, FaTimes } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, transformImage } from '../services/ImageTransformService';
import ChatList from '../components/ChatList';
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

type concentrationPoint = {
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

const DashboardDirigente = () => {
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
   
  // Lógica de "recyclers" removida en este panel (manejada en DashboardReferente)

  // Estado para controlar solicitudes de fitBounds/centrado al Map (removido: lógica de mapa movida a Referente)

// --- Persistencia de estado del tab activo ---
const [activeTab, setActiveTab] = useState<'puntos' | 'perfil' | 'historial' | 'mensajes'>(() => {
  // Verificar si hay un parámetro de tab en la URL
  const urlParams = new URLSearchParams(location.search);
  const urlTab = urlParams.get('tab');
  
  if (urlTab === 'puntos' || urlTab === 'perfil' || urlTab === 'historial' || urlTab === 'mensajes') {
    return urlTab;
  }
  
  // Si no hay parámetro de URL, usar el cached
  const cachedTab = sessionStorage.getItem('dashboard_dirigente_active_tab');
  if (cachedTab === 'puntos' || cachedTab === 'perfil' || cachedTab === 'historial' || cachedTab === 'mensajes') {
    return cachedTab;
  }
  return 'puntos';
});

// --- Sincronizar cambios de Dirigentes y tab con sessionStorage ---
// Persistencia de `recyclers_online` ahora manejada por el panel de Referentes.

useEffect(() => {
  sessionStorage.setItem('dashboard_dirigente_active_tab', activeTab);
}, [activeTab]);

  // --- Estado y lógica para badge de mensajes ---

  // Suscripciones y fetch de recicladores están manejadas por DashboardReferente.
  // Este panel ya no corre polling ni suscripciones para recicladores.

  // Estado para la pestaña activa (activeTab)
  type DetailedPoint = concentrationPoint & {
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
      const channelName = `dirigente-dashboard-${user.id}-${Date.now()}`;
      
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
  // Eliminadas suscripciones a concentration_claims (la app ahora solo gestiona concentration_points)
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
  // eslint-disable-next-line no-empty-pattern
  const [] = useState<'todos'>(() => 'todos');
  // Normaliza claim: si es array, toma el primero; si es objeto, lo deja igual
// Tipos para los claims y Dirigentes
// RecyclerType eliminado (no usado en este componente)

// ClaimType eliminado (la app ya no usa concentration_claims en el cliente)

// Categorías simples basadas en `status` del punto
  const puntosTodos = detailedPoints.filter(p => !p.status || p.status === 'available');
// Ya no se distinguen puntos 'claimed' en el cliente; tratamos todos según su status base
const puntosReclamados: typeof detailedPoints = [];
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

// Estado para EcoCreditos del usuario (puedes inicializarlo con el valor que corresponda, por ejemplo 100)
const [ecoCreditos, setEcoCreditos] = useState<number>(100);

// Estado para el objetivo de calificación (modal de calificaciones)
// eslint-disable-next-line no-empty-pattern
const [] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string } | null>(null);

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
  // Obtener lista de recyclers desde sessionStorage si existe
  const cached = sessionStorage.getItem('recyclers_online');
  const currentRecyclers = cached ? JSON.parse(cached) as Array<{ user_id?: string }> : [];
  if (!user?.id || currentRecyclers.length === 0) return;
  let isMounted = true;
  // Función para cargar los mensajes no leídos por reciclador
  const fetchUnread = async () => {
    const recyclerUserIds = currentRecyclers.map(r => r.user_id).filter(Boolean);
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
    const channelName = `dirigente-messages-badge-${user.id}-${Date.now()}`;
    
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
}, [user]);

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

// Limpiar badges para recicladores se maneja desde el panel de Referentes cuando aplica.

  useEffect(() => {
    // Refresca puntos si se navega con el flag refresh (tras crear un punto)
    const locState = (location as typeof location & { state?: unknown }).state as { refresh?: boolean } | undefined;
    if (locState && locState.refresh) {
      // refreshconcentrationPoints(); // Eliminar o comentar
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
// El campo 'materials' no existe en la tabla profiles; se elimina su estado local

// EcoCuenta removed: state and effects for EcoCreditos and rewards were removed

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
          <p className="text-gray-500 capitalize text-lg">{user?.type === 'dirigente' ? 'Dirigente' : user?.type || 'Usuario'}</p>
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
      <Link to="/concentration-points" className="block px-6 py-4 rounded-md font-bold text-blue-700 hover:bg-blue-700 hover:text-white">
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
          {/* Opción 'Dirigentes' eliminada del tab */}
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
          {/* EcoCuenta tab removed */}
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
      <span className="px-3 py-1 rounded mb-2 md:mb-0 min-w-[120px] text-sm font-semibold bg-blue-600 text-white">Disponibles</span>
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
              to="/add-concentration-point"
              className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 focus:ring-4 focus:ring-blue-400 focus:outline-none shadow-xl transition-all duration-300 w-fit mb-4 group animate-bounce animate-delay-500 animate-once animate-ease-in-out animate-fill-both animate-fast animate-important border-2 border-blue-400 scale-105 hover:scale-110 ring-4 ring-blue-300/40 hover:ring-blue-500/60"
              style={{ minWidth: 'unset', maxWidth: '220px', boxShadow: '0 0 0 4px #bbf7d0, 0 8px 24px 0 rgba(34,197,94,0.15)' }}
            >
              <FaPlus className="h-4 w-4 mr-1 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold tracking-wide text-base animate-pulse">Agregar centro</span>
            </Link>
            <div className="mt-4">
                  {(() => {
                    // Mostrar únicamente puntos disponibles
                    const list = puntosTodos;

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
                                  <span className={`px-2 py-1 rounded-full text-xs ${p.status === 'available' ? 'bg-green-100 text-green-800' : p.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                                    {p.status || 'unknown'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // La visualización de mapa para puntos está en el panel de Referente. Navegar a la lista de puntos.
                                    const el = document.getElementById('dirigente-points-map');
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          </div>
        </div>
      )}
  {/* Opción 'Dirigentes' removida del panel; la UI relevante está en Referente */}
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
  {/* EcoCuenta removed */}
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
              {/* Campo 'materials' eliminado porque no existe en la tabla profiles */}
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

export default DashboardDirigente;



