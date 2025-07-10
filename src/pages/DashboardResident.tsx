import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Calendar, Plus, Star, Mail, Phone, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, transformImage } from '../services/ImageTransformService';
import Map from '../components/Map';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast';
import RecyclerRatingsModal from '../components/RecyclerRatingsModal';
import PhotoCapture from '../components/PhotoCapture';
import MyRecyclerRatingsModal from '../components/MyRecyclerRatingsModal';
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
  
    // --- Estado de recicladores en línea con persistencia en sessionStorage ---
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

// --- Persistencia de estado del tab activo ---
const [activeTab, setActiveTab] = useState<'puntos' | 'recicladores' | 'perfil' | 'historial'>(() => {
  const cachedTab = sessionStorage.getItem('dashboard_resident_active_tab');
  if (cachedTab === 'puntos' || cachedTab === 'recicladores' || cachedTab === 'perfil' || cachedTab === 'historial') {
    return cachedTab;
  }
  return 'puntos';
});

// --- Sincronizar cambios de recicladores y tab con sessionStorage ---
useEffect(() => {
  sessionStorage.setItem('recyclers_online', JSON.stringify(recyclers));
}, [recyclers]);

useEffect(() => {
  sessionStorage.setItem('dashboard_resident_active_tab', activeTab);
}, [activeTab]);

  // --- Estado y lógica para badge de mensajes ---

  useEffect(() => {
    // const fetchCollectionPoints = async () => {
    //   const { data, error } = await supabase
    //     .from('collection_points')
    //     .select('*')
    //     .eq('user_id', user?.id);
    //   if (error) {
    //     setError('Error al cargar los puntos de recolección');
    //   } else {
    //     setCollectionPoints(data);
    //   }
    // };
    // if (user) {
    //   fetchCollectionPoints();
    // }
  }, [user]);

  // Suscripción realtime SIEMPRE (no depende del tab)
  useEffect(() => {
    // --- Lógica mejorada: fetch inmediato tras cualquier cambio relevante (INSERT, UPDATE, DELETE) ---
    // IMPORTANTE: Esta suscripción + polling garantiza que los recicladores en línea se actualicen en tiempo real en el panel del residente.
    // Si alguna vez se pierde la actualización inmediata de recicladores, restaurar este bloque con polling + fetch tras cada evento realtime.
    // Esta es la forma más robusta para reflejar cambios de sesión de recicladores sin recargar la página.
    let isMounted = true;
    const fetchOnlineRecyclers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'recycler')
        .eq('online', true);
      if (!error && Array.isArray(data) && isMounted) {
        setRecyclers(
          data.map((rec: ProfileRealtimePayload) => ({
            id: String(rec.id),
            user_id: rec.user_id,
            role: rec.role ?? 'recycler',
            profiles: {
              avatar_url: rec.avatar_url,
              name: rec.name,
              email: rec.email,
              phone: rec.phone,
              dni: rec.dni,
            },
            rating_average: rec.rating_average,
            total_ratings: rec.total_ratings,
            materials: Array.isArray(rec.materials)
              ? rec.materials
              : (typeof rec.materials === 'string' && rec.materials.length > 0
                  ? [rec.materials]
                  : []),
            bio: rec.bio,
            lat: typeof rec.lat === 'number' ? rec.lat : (rec.lat !== null && rec.lat !== undefined ? Number(rec.lat) : undefined),
            lng: typeof rec.lng === 'number' ? rec.lng : (rec.lng !== null && rec.lng !== undefined ? Number(rec.lng) : undefined),
            online: rec.online === true || rec.online === 'true' || rec.online === 1,
          }))
        );
      } else if (isMounted) {
        setRecyclers([]);
      }
    };

    // Fetch inicial
    fetchOnlineRecyclers();

    // Suscripción realtime: cualquier cambio relevante en profiles dispara fetch
    const channel = supabase.channel('recyclers-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'role=eq.recycler',
        },
        () => {
          // Forzar fetch incluso en UPDATE y DELETE
          fetchOnlineRecyclers();
        }
      )
      .subscribe();

    // Además, polling cada 5 segundos como fallback para máxima inmediatez (reducido de 2s para mejor rendimiento)
    const interval = setInterval(fetchOnlineRecyclers, 5000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Estado para la pestaña activa (activeTab)
  const [activePointsTab, setActivePointsTab] = useState<'todos' | 'disponibles' | 'reclamados' | 'demorados' | 'retirados' | 'completados'>('todos');
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
  };
  const [detailedPoints, setDetailedPoints] = useState<DetailedPoint[]>([]);
  
  // Estado para indicar cuando se están actualizando los datos en tiempo real
  const [isUpdatingRealtime, setIsUpdatingRealtime] = useState(false);

  // Función para cargar puntos con detalles de reclamo y reciclador
  const fetchDetailedPoints = useCallback(async () => {
    if (!user?.id) return;
    
    setIsUpdatingRealtime(true);
    
    try {
      const { data, error } = await supabase
        .from('collection_points')
        .select(`
          *,
          claim:collection_claims!collection_point_id(
            id,
            status,
            pickup_time,
            collection_point_id,
            recycler_id,
            recycler:profiles!recycler_id(
              id,
              user_id,
              name,
              avatar_url,
              email,
              phone,
              alias
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (isDebugMode) {
        console.log('[DEBUG] Consulta SQL resultado:', { data, error });
      }
      
      if (!error && data) {
        setDetailedPoints(data);
      } else {
        if (error && isDebugMode) {
          console.error('[ERROR] Error al cargar puntos:', error);
        }
        setDetailedPoints([]);
      }
    } catch (err) {
      if (isDebugMode) {
        console.error('[ERROR] Error inesperado al cargar puntos:', err);
      }
      setDetailedPoints([]);
    } finally {
      // Pequeño retraso para mostrar el indicador de actualización
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

    // Crear una sola suscripción que maneje ambas tablas
    const channel = supabase.channel(`resident-dashboard-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_points',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (isDebugMode) {
          console.log('[REALTIME] Cambio en collection_points para usuario:', payload);
        }
        // Actualizar inmediatamente solo para cambios en nuestros puntos
        fetchDetailedPoints();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'collection_claims',
      }, async (payload) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[REALTIME] Nuevo claim creado:', payload);
        }
        
        const newClaim = payload.new as Record<string, unknown>;
        const collectionPointId = newClaim.collection_point_id;
        const recyclerId = newClaim.recycler_id;
        
        // Verificar si es un punto del usuario actual usando una sola consulta con join
        try {
          const { data: pointData } = await supabase
            .from('collection_points')
            .select(`
              id, address, user_id,
              recycler:profiles(name, avatar_url)
            `)
            .eq('id', collectionPointId)
            .eq('user_id', user.id)
            .single();
          
          if (pointData) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[REALTIME] ¡Nuevo claim en punto del usuario actual!');
            }
            
            // Actualizar datos
            fetchDetailedPoints();
            
            // Obtener nombre del reciclador por separado para evitar problemas de tipado
            const { data: recyclerData } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('id', recyclerId)
              .single();
            
            const recyclerName = recyclerData?.name || 'Un reciclador';
            
            // Mostrar notificación automatizada
            showAutomaticNotification(
              `¡${recyclerName} ha reclamado tu punto de recolección en "${pointData.address}"!`,
              {
                icon: '🚀',
                duration: 8000,
                type: 'success'
              }
            );
          }
        } catch (error) {
          console.error('[REALTIME] Error al verificar nuevo claim:', error);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'collection_claims',
      }, async (payload) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[REALTIME] Claim actualizado:', payload);
        }
        
        const updatedClaim = payload.new as Record<string, unknown>;
        const status = updatedClaim.status as string;
        const collectionPointId = updatedClaim.collection_point_id;
        
        // Solo procesar si el estado cambió a completed
        if (status === 'completed') {
          try {
            const { data: pointData } = await supabase
              .from('collection_points')
              .select('id, address, user_id')
              .eq('id', collectionPointId)
              .eq('user_id', user.id)
              .single();
            
            if (pointData) {
              if (process.env.NODE_ENV === 'development') {
                console.log('[REALTIME] ¡Punto completado del usuario actual!');
              }
              
              // Actualizar datos
              fetchDetailedPoints();
              
              showAutomaticNotification(
                `¡El material de tu punto en "${pointData.address}" ha sido retirado exitosamente!`,
                {
                  icon: '✅',
                  duration: 6000,
                  type: 'success'
                }
              );
            }
          } catch (error) {
            console.error('[REALTIME] Error al verificar punto completado:', error);
          }
        } else {
          // Para otros cambios de estado, solo actualizar datos si es nuestro punto
          try {
            const { data: pointExists } = await supabase
              .from('collection_points')
              .select('id')
              .eq('id', collectionPointId)
              .eq('user_id', user.id)
              .single();
            
            if (pointExists) {
              fetchDetailedPoints();
            }
          } catch {
            // Silencioso - puede que el punto no sea nuestro
          }
        }
      })
      .subscribe((status) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[REALTIME] Estado de suscripción:', status);
          if (status === 'SUBSCRIBED') {
            console.log('[REALTIME] ¡Suscripción activa para usuario:', user.id);
          }
        }
      });

    return () => {
      if (isDebugMode) {
        console.log('[REALTIME] Limpiando suscripción...');
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
  const now = new Date();
  // Normaliza claim: si es array, toma el primero; si es objeto, lo deja igual
// Tipos para los claims y recicladores
interface RecyclerType {
  dni?: string;
  id?: string;
  user_id?: string;
  name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  alias?: string;
  rating_average?: number; // Hacer opcional
}

interface ClaimType {
  id?: string;
  status?: string;
  pickup_time?: string;
  recycler_id?: string; // ID directo del reciclador en la tabla claims
  recycler?: RecyclerType;
}

// Normaliza el claim para asegurar que el tipo es correcto y rating_average es opcional
function normalizeClaim(claim: unknown): ClaimType | undefined {
  if (!claim) return undefined;
  
  // Si claim es un array, tomar el más reciente (último elemento)
  if (Array.isArray(claim)) {
    if (claim.length === 0) return undefined;
    const latestClaim = claim[claim.length - 1];
    return normalizeClaim(latestClaim);
  }
  
  if (typeof claim !== 'object') return undefined;
  
  const c = claim as ClaimType;
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Normalizando claim:', c);
  }
  
  if (c.recycler && typeof c.recycler === 'object') {
    return {
      ...c,
      recycler: {
        ...c.recycler,
        rating_average: c.recycler.rating_average ?? undefined,
      },
    };
  }
  return c as ClaimType;
}

const puntosTodos = detailedPoints.filter(p => {
  const claim = normalizeClaim(p.claim);
  // Un punto está disponible si su status es 'available' o vacío y NO tiene claim activo (status: 'claimed')
  return (!claim || claim.status !== 'claimed');
});

// Ajustar filtro de puntos reclamados para depender solo de claim.status === 'claimed'
const puntosReclamados = detailedPoints.filter(p => {
  const claim = normalizeClaim(p.claim);
  return claim && claim.status === 'claimed';
});

const puntosRetirados = detailedPoints.filter(p => {
  const claim = normalizeClaim(p.claim);
  if (p.status === 'completed') return true;
  if (claim && claim.status === 'completed') return true;
  return false;
});

const puntosDemorados = detailedPoints.filter(p => {
  const claim = normalizeClaim(p.claim);
  if (claim && claim.status === 'claimed' && claim.pickup_time) {
    const pickup = new Date(claim.pickup_time);
    return pickup < now;
  }
  return false;  });

  // DEBUG LOGS - Solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Total detailedPoints:', detailedPoints.length);
    console.log('[DEBUG] detailedPoints con claims:', detailedPoints.map(p => ({
      id: p.id,
      address: p.address,
      claim: p.claim,
      claimStatus: p.claim?.status,
      recyclerInfo: p.claim?.recycler
    })));
    console.log('[DEBUG] puntosTodos:', puntosTodos.length, puntosTodos.map(p => p.id));
    console.log('[DEBUG] puntosReclamados:', puntosReclamados.length, puntosReclamados.map(p => p.id));
    console.log('[DEBUG] puntosRetirados:', puntosRetirados.length, puntosRetirados.map(p => {
      const claim = normalizeClaim(p.claim);
      return {
        id: p.id,
        address: p.address,
        recycler: claim?.recycler,
        recyclerId: claim?.recycler?.id || claim?.recycler_id
      };
    }));
    console.log('[DEBUG] puntosDemorados:', puntosDemorados.length, puntosDemorados.map(p => p.id));
  }

  // Función para volver a poner un punto como disponible
  const handleMakeAvailableAgain = async (point: DetailedPoint) => {
    try {
      // 1. Crear un nuevo punto disponible (NO copiar campos de reclamo)
      const { data: newPoint, error: createError } = await supabase
        .from('collection_points')
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
        .from('collection_points')
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
        .from('collection_points')
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

// --- Calificación de recicladores ---
const [showRatingsModal, setShowRatingsModal] = useState(false);
const [ratingsModalTarget, setRatingTarget] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string } | null>(null);
const [showMyRecyclerRatingsModal, setShowMyRecyclerRatingsModal] = useState<{ recyclerId: string; recyclerName?: string; avatarUrl?: string } | false>(false);

// --- Estado para el modal de donación ---
const [showDonationModal, setShowDonationModal] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string; alias?: string } | null>(null);
const [donationAmount, setDonationAmount] = useState<number>(0);

// --- Estado para el modal de edición de imagen de cabecera ---
const [showHeaderImageModal, setShowHeaderImageModal] = useState(false);

// --- Estado para mensajes no leídos por reciclador ---
const [unreadMessagesByRecycler, setUnreadMessagesByRecycler] = useState<Record<string, number>>({});

// --- Efecto para cargar y suscribirse a mensajes no leídos ---
useEffect(() => {
  if (!user?.id || recyclers.length === 0) return;
  let isMounted = true;
  // Función para cargar los mensajes no leídos por reciclador
  const fetchUnread = async () => {
    const recyclerUserIds = recyclers.map(r => r.user_id).filter(Boolean);
    if (recyclerUserIds.length === 0) return;
    // Buscar mensajes no leídos enviados por cada reciclador al residente
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
  // Suscripción realtime a nuevos mensajes
  const channel = supabase.channel('resident-messages-badge')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id=eq.${user.id}`,
    }, fetchUnread)
    .subscribe();
  return () => {
    isMounted = false;
    supabase.removeChannel(channel);
  };
}, [user, recyclers]);

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

// Limpiar todos los badges al abrir la pestaña de recicladores
useEffect(() => {
  if (activeTab === 'recicladores') {
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
    // Refresca puntos si se navega with el flag refresh (tras crear un punto)
    if (location.state && location.state.refresh) {
      // refreshCollectionPoints(); // Eliminar o comentar
      // Limpia el state para evitar refrescos innecesarios al navegar de nuevo
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Eliminamos la función local y usamos la centralizada desde feedbackHelper
  // Esta línea se conserva solo para documentación, pero no tiene efecto
  // La función anterior solo reemplazaba rutas internas, pero no manejaba casos cuando no hay URL

  // Estado para mostrar el modal de eliminar cuenta
  const [, setShowDeleteAccount] = useState(false);

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

  // Suscripción a cambios en puntos de recolección
  useEffect(() => {
    if (!user?.id) return;

    const pointsSubscription = supabase
      .channel('collection_points_general')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_points' }, payload => {
        console.log('Evento general en puntos de recolección:', payload);
        // Actualizar estado o lógica según sea necesario
      })
      .subscribe();

    // Suscripción a cambios en claims - mejorada para tiempo real
    const claimsSubscription = supabase
      .channel('claims_general')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_claims' }, payload => {
        console.log('Evento general en claims:', payload);
        
        // Si es un nuevo claim (INSERT) o una actualización (UPDATE), mostrar notificación
        if (payload.eventType === 'INSERT') {
          const newClaim = payload.new as Record<string, unknown>;
          console.log('Nuevo claim creado:', newClaim);
          
          // Verificar si el claim es para un punto del usuario actual
          // (Esta verificación se hará cuando se recarguen los datos detallados)
        } else if (payload.eventType === 'UPDATE') {
          const updatedClaim = payload.new as Record<string, unknown>;
          console.log('Claim actualizado:', updatedClaim);
        }
      })
      .subscribe();

    // Cleanup de las suscripciones al desmontar el componente
    return () => {
      supabase.removeChannel(pointsSubscription);
      supabase.removeChannel(claimsSubscription);
    };
  }, [user?.id]);

  // --- Estado para verificar si está asociado a un punto colectivo ---
  const [isAssociatedToCollectivePoint, setIsAssociatedToCollectivePoint] = useState<boolean>(false);
  const [collectivePointInfo, setCollectivePointInfo] = useState<{ address: string; institutionalName: string } | null>(null);

  // --- Verificar si el residente está asociado a un punto colectivo ---
  useEffect(() => {
    async function checkCollectivePointAssociation() {
      if (!user?.id || !user?.address) {
        setIsAssociatedToCollectivePoint(false);
        setCollectivePointInfo(null);
        return;
      }

      // Buscar si existe un punto colectivo con la misma dirección del usuario
      const { data: collectivePoint, error } = await supabase
        .from('collection_points')
        .select(`
          id, 
          address, 
          type,
          profiles!collection_points_user_id_fkey(name)
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
            className="cursor-pointer bg-green-600 text-white px-3 py-2 rounded shadow hover:bg-green-700 transition-all text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 19.5V7.125c0-.621.504-1.125 1.125-1.125h3.38c.414 0 .788-.252.94-.639l.57-1.522A1.125 1.125 0 018.21 3.75h7.58c.482 0 .915.304 1.07.764l.57 1.522c.152.387.526.639.94.639h3.38c.621 0 1.125.504 1.125 1.125V19.5a1.125 1.125 0 01-1.125 1.125H3.375A1.125 1.125 0 012.25 19.5z" />
              <circle cx="12" cy="13.5" r="3.75" />
            </svg>
            imagen
          </button>
        </div>
        {/* Imagen de cabecera grande */}
        <div className="w-full h-40 md:h-56 rounded-2xl overflow-hidden flex items-center justify-center bg-green-100 border-2 border-green-300 mb-4 relative" style={{ minHeight: '160px', maxHeight: '220px' }}>
          <img
            src={user?.header_image_url || 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png'}
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
          <h2 className="text-3xl font-extrabold text-green-700 mb-1">{user?.name || 'Residente'}</h2>
          <p className="text-gray-500 capitalize text-lg">{user?.type === 'resident' ? 'Residente' : user?.type || 'Usuario'}</p>
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
          {/* Menú desplegable de usuario */}
          <div className="relative mt-2">
            <details className="group">
              <summary className="cursor-pointer text-green-700 hover:underline">Opciones</summary>
              <ul className="absolute left-0 mt-2 w-48 bg-white border rounded shadow-lg z-10">
                <li>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => setActiveTab('perfil')}
                  >
                    Mi Perfil
                  </button>
                </li>
                {isAssociatedToCollectivePoint && (
                  <li>
                    <button
                      className="w-full text-left px-4 py-2 text-orange-600 hover:bg-orange-50"
                      onClick={async () => {
                        if (window.confirm('¿Estás seguro de que quieres desvincularte del punto colectivo? Podrás volver a asociarte usando el código QR de la institución.')) {
                          try {
                            const { error } = await supabase
                              .from('profiles')
                              .update({ address: null })
                              .eq('user_id', user?.id);
                            if (error) {
                              toast.error('Error al desvincularse: ' + error.message);
                            } else {
                              setIsAssociatedToCollectivePoint(false);
                              setCollectivePointInfo(null);
                              if (user) {
                                login({ ...user, address: undefined });
                              }
                              toast.success('Te has desvinculado del punto colectivo exitosamente.');
                            }
                          } catch {
                            toast.error('Error inesperado al desvincularse.');
                          }
                        }
                      }}
                    >
                      Desvincular del punto colectivo
                    </button>
                  </li>
                )}
                <li>
                  <button
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                    onClick={() => setShowDeleteAccount(true)}
                  >
                    Eliminar cuenta
                  </button>
                </li>
              </ul>
            </details>
          </div>
        </div>
      </div>
      <Link to="/collection-points" className="block px-6 py-4 rounded-md font-bold text-green-700 hover:bg-green-700 hover:text-white">
        <img
          src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1747796657/icon_map.mp4_uphkzx.gif"
          alt="Mapa"
          className="inline-block w-15 h-12 mr-4 rounded-md align-middle"
          style={{ verticalAlign: 'middle' }}
        />
        Puntos de Recolección ( Global )
      </Link>

      {/* Separador visual */}
      <div className="my-6 w-full max-w-4xl">
        <hr className="border-t-2 border-green-100" />
      </div>

      <div className="flex space-x-1 mb-10">
        <button
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 relative
            ${activeTab === 'puntos'
              ? 'bg-green-600 text-white shadow-lg scale-105 active-tab-effect'
              : 'bg-gray-200 text-gray-700 hover:bg-green-100'}
          `}
          onClick={() => setActiveTab('puntos')}
        >
          Mis Puntos
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 relative
            ${activeTab === 'recicladores'
              ? 'bg-green-600 text-white shadow-lg scale-105 active-tab-effect'
              : 'bg-gray-200 text-gray-700 hover:bg-green-100'}
          `}
          onClick={() => setActiveTab('recicladores')}
        >
          Recicladores
          {/* Badge rojo si hay mensajes no leídos */}
          {Object.values(unreadMessagesByRecycler).some(count => count > 0) && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold shadow-lg border-2 border-white animate-pulse z-10">
              ●
            </span>
          )}
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 relative
            ${activeTab === 'perfil'
              ? 'bg-green-600 text-white shadow-lg scale-105 active-tab-effect'
              : 'bg-gray-200 text-gray-700 hover:bg-green-100'}
          `}
          onClick={() => setActiveTab('perfil')}
        >
          Mi Perfil
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 relative
            ${activeTab === 'historial'
              ? 'bg-green-600 text-white shadow-lg scale-105 active-tab-effect'
              : 'bg-gray-200 text-gray-700 hover:bg-green-100'}
          `}
          onClick={() => setActiveTab('historial')}
        >
          Historial
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
              <h2 className="text-2xl font-bold">Mis Puntos de Recolección</h2>
              {isUpdatingRealtime && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-semibold animate-fade-in">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  Sincronizando datos...
                </div>
              )}
            </div>
            {/* Enlace para agregar punto: elimina el paso de función por state */}
            <Link
              to="/add-collection-point"
              className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700 focus:ring-4 focus:ring-green-400 focus:outline-none shadow-xl transition-all duration-300 w-fit mb-4 group animate-bounce animate-delay-500 animate-once animate-ease-in-out animate-fill-both animate-fast animate-important border-2 border-green-400 scale-105 hover:scale-110 ring-4 ring-green-300/40 hover:ring-green-500/60"
              style={{ minWidth: 'unset', maxWidth: '220px', boxShadow: '0 0 0 4px #bbf7d0, 0 8px 24px 0 rgba(34,197,94,0.15)' }}
            >
              <Plus className="h-4 w-4 mr-1 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold tracking-wide text-base animate-pulse">Agregar Punto</span>
            </Link>
            {(() => {
              let pointsToShow = puntosTodos;
              if (activePointsTab === 'reclamados') pointsToShow = puntosReclamados;
              if (activePointsTab === 'demorados') pointsToShow = puntosDemorados;
              if (activePointsTab === 'retirados') pointsToShow = puntosRetirados;
              if (pointsToShow.length === 0) return <p className="text-gray-500">No hay puntos en esta categoría.</p>;
              return (
                <ul className="space-y-4">
                  {pointsToShow.map((point) => {
                    const claim = normalizeClaim(point.claim);
                    const isClaimed = claim && claim.status === 'claimed';
                    // Determinar si el punto debe verse apagado
                    let isInactive = false;
                    if (activePointsTab === 'todos') {
                      isInactive = point.status === 'completed' || !!(point.claim && point.claim.status === 'completed');
                    } else if (activePointsTab === 'reclamados' || activePointsTab === 'demorados') {
                      isInactive = false; // Ahora los puntos reclamados y demorados están activos
                    } // En 'retirados' nunca se apaga


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
                            {isClaimed && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold border border-yellow-300">Reclamado</span>
                            )}
                            {activePointsTab === 'todos' && (!point.status || point.status === 'available') && !isClaimed && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300">Disponible</span>
                            )}
                            {point.status === 'completed' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold border border-green-300">Retirado</span>
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
                          <p className="text-gray-500"><MapPin className="inline-block w-4 h-4 mr-1" />{point.district}</p>
                          <p className="text-gray-500"><Calendar className="inline-block w-4 h-4 mr-1" />{point.schedule}</p>
                          {/* Mostrar notas adicionales si existen */}
                          {point.notas && (<p className="text-gray-600 mt-2 text-sm"><b>Notas adicionales:</b> {point.notas}</p>)}
                          {point.additional_info && (<p className="text-gray-600 mt-2 text-sm"><b>Información adicional:</b> {point.additional_info}</p>)}
                          {/* Info del reciclador reclamante */}
                          {isClaimed && claim && claim.recycler && (
                            <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 shadow-sm flex-wrap">
                              <img
                                src={getAvatarUrl(claim.recycler.avatar_url, claim.recycler.name, 'FACC15', 'fff')}
                                alt="Avatar reciclador"
                                className="w-10 h-10 rounded-full border-2 border-yellow-400 object-cover"
                              />
                              <div className="flex flex-col min-w-[120px]">
                                <span className="font-semibold text-yellow-800 text-base flex items-center gap-1">
                                  {claim.recycler.name || 'Reciclador'}
                                </span>
                                {claim.recycler.phone && (
                                  <span className="text-gray-600 text-sm flex items-center gap-1">
                                    <Phone className="w-4 h-4 text-yellow-500" />{claim.recycler.phone}
                                  </span>
                                )}
                                {claim.recycler.dni && (
                                  <span className="text-gray-500 text-sm flex items-center gap-1">
                                    <span className="font-semibold mr-2">DNI:</span>{claim.recycler.dni}
                                  </span>
                                )}
                                <span className="text-yellow-700 text-sm flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-400" />
                                  {typeof claim.recycler.rating_average === 'number' ? claim.recycler.rating_average.toFixed(1) : 'N/A'}
                                </span>
                              </div>
                              {/* Botón para volver a disponible solo en tab demorados */}
                              {activePointsTab === 'demorados' && (
                                <button
                                  onClick={async () => {
                                    await handleMakeAvailableAgain(point);
                                  }}
                                  className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-md animate-bounce"
                                >
                                  Disponible
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Imagen estática en vez de GIF animado */}
                        <div className="flex-shrink-0 flex margin rigth items-center md:ml-6 mt-4 md:mt-0">
                          <div className={`transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-green-300 hover:shadow-lg rounded-lg ${isInactive ? 'grayscale' : ''}`}> 
                            <img
                              src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png"
                              alt="Punto de Recolección"
                              className={`w-40 h-28 object-contain rounded-lg shadow-md border border-green-200 ${isInactive ? 'grayscale' : ''}`}
                              style={{ background: '#f0fdf4' }}
                            />
                          </div>
                        </div>
                        {/* Contenedor de botones de acción - Responsive y organizado */}
                        <div className="w-full md:w-auto mt-4 md:mt-0 md:ml-4">
                          <div className="flex flex-col gap-2">
                            {/* Botón para volver a disponible solo en tab demorados */}
                            {activePointsTab === 'demorados' && (
                              <button
                                onClick={() => handleMakeAvailableAgain(point)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-md animate-bounce w-full md:w-auto text-sm font-semibold"
                              >
                                ✅ Disponible
                              </button>
                            )}
                            
                            {/* Botones para puntos retirados: Volver a disponible, Calificar y Donar */}
                            {activePointsTab === 'retirados' && (
                              <>
                                <button
                                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-md w-full text-sm font-semibold flex items-center justify-center gap-2"
                                  onClick={() => handleMakeAvailableAgain(point)}
                                  type="button"
                                >
                                  🔄 Volver a disponible
                                </button>
                                
                                {/* Siempre mostrar botones de calificar y donar en puntos retirados */}
                                {(() => {
                                  // Intentar obtener información del reciclador de diferentes fuentes
                                  const claim = normalizeClaim(point.claim);
                                  const recyclerId = claim?.recycler?.id || claim?.recycler_id || '';
                                  const recyclerName = claim?.recycler?.name || 'Reciclador';
                                  const recyclerAlias = claim?.recycler?.alias || '';
                                  const avatarUrl = claim?.recycler?.avatar_url;

                                  return (
                                    <>
                                      <button
                                        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 shadow-md w-full text-sm font-semibold flex items-center justify-center gap-2"
                                        onClick={() => {
                                          if (recyclerId) {
                                            setRatingTarget({ recyclerId, recyclerName, avatarUrl });
                                            setShowRatingsModal(true);
                                          } else {
                                            toast.error('No se pudo encontrar información del reciclador para calificar');
                                          }
                                        }}
                                        type="button"
                                      >
                                        <Star className="w-4 h-4" />
                                        Calificar reciclador
                                      </button>
                                      <button
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md w-full text-sm font-semibold flex items-center justify-center gap-2"
                                        onClick={() => {
                                          if (recyclerId) {
                                            setShowDonationModal({
                                              recyclerId,
                                              recyclerName,
                                              avatarUrl,
                                              alias: recyclerAlias
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
                            {(!isClaimed && point.status !== 'completed') && (
                              <button
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow-md w-full md:w-auto text-sm font-semibold flex items-center justify-center gap-2"
                                onClick={() => handleDeletePoint(point)}
                                type="button"
                              >
                                <X className="w-4 h-4" />
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
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex flex-col items-center justify-center text-center">
              <span>
                <span className="text-black">Ver Recicladores </span>
                <span className="inline-flex items-center relative -top-1.5">
      
      <button
        type="button"
        className="px-3 py-1 rounded-full bg-green-600 text-white font-semibold shadow-md border border-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition-all duration-200 text-sm flex items-center gap-1 animate-pulse"
        style={{ boxShadow: '0 0 0 2px #bbf7d0' }}
        tabIndex={-1}
        disabled
      >
        <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
        En Línea
      </button>
    </span>
                <span className="text-black"> en el Mapa</span>
              </span>
            </h3>
            <Map
  markers={recyclers
    .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number' && r.online === true)
    .map((rec) => ({
      id: rec.id.toString(),
      lat: rec.lat ?? 0,
      lng: rec.lng ?? 0,
      title: rec.profiles?.name || 'Reciclador',
      avatar_url: rec.profiles?.avatar_url || undefined,
      role: 'recycler',
      online: rec.online === true,
      iconUrl: '/assets/bicireciclador-Photoroom.png',
    }))}
  showUserLocation={true}
  showAdminZonesButton={false}
/>
            {/* DEBUG: Mostrar recicladores que deberían aparecer en el mapa */}
          <div className="mt-4 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-900">
            <b>Recicladores en línea con coordenadas:</b>
            <ul>
              {recyclers.filter(r => typeof r.lat === 'number' && typeof r.lng === 'number' && r.online === true).map(r => (
                <li key={r.id}>
                  {r.profiles?.name || 'Reciclador'} | lat: {r.lat}, lng: {r.lng} | online: {String(r.online)}
                </li>
              ))}
            </ul>
          </div>
          </div>
        </div>
      )}
      {activeTab === 'recicladores' && (
        <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-center">Recicladores</h2>
          {recyclers.filter(r => r.role === 'recycler' && r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number' && !isNaN(r.lat) && !isNaN(r.lng)).length === 0 ? (
            <p className="text-gray-500 text-center">No hay recicladores en línea con ubicación disponible.</p>
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
                  <div className="w-20 h-20 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
                    <img src={getAvatarUrl(rec.profiles?.avatar_url, rec.profiles?.name, '22c55e', 'fff')} 
                         alt="Foto de perfil" 
                         className="w-full h-full object-cover" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-700 mb-1 flex items-center gap-2">
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
                    onClick={() => setShowMyRecyclerRatingsModal({
                      recyclerId: rec.id, // id interno de profiles
                      recyclerName: rec.profiles?.name || 'Reciclador',
                      avatarUrl: rec.profiles?.avatar_url
                    })}
                  >
                    <span className="flex items-center">
                      <Star className="h-5 w-5 text-yellow-400 mr-1" />
                      <span className="font-semibold text-gray-700 text-base">
                        {typeof rec.rating_average === 'number' ? rec.rating_average.toFixed(1) : 'N/A'}
                      </span>
                    </span>
                    <span className="text-gray-500 text-sm">({rec.total_ratings || 0})</span>
                  </button>
                  {/* Mostrar email y teléfono si existen */}
                  {rec.profiles?.email && (
                    <p className="text-gray-500 text-sm mb-1 flex items-center"><Mail className="h-4 w-4 mr-1" />{rec.profiles.email}</p>
                  )}
                  {rec.profiles?.phone && (
                    <p className="text-gray-500 text-sm mb-1 flex items-center"><Phone className="h-4 w-4 mr-1" />{rec.profiles.phone}</p>
                  )}
                  {rec.profiles?.dni && (
                    <p className="text-gray-500 text-sm mb-1 flex items-center"><span className="font-semibold mr-2">DNI:</span>{rec.profiles.dni}</p>
                  )}
                  {rec.bio && <p className="text-gray-600 text-xs mt-2 text-center">{rec.bio}</p>}
                  {/* Validación de UUID para el chat */}
                  {rec.user_id && /^[0-9a-fA-F-]{36}$/.test(rec.user_id) ? (
                    <Link
                      to={`/chat/${rec.user_id}`}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 disabled:pointer-events-none relative"
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
        </div>
      )}
      {/* Sección Mi EcoCuenta (solo una vez, antes del formulario de perfil) */}
      {activeTab === 'perfil' && (
        <div className="w-full max-w-2xl bg-gradient-to-br from-green-50 via-emerald-100 to-green-200 shadow-xl rounded-3xl p-8 flex flex-col items-center mb-8 relative overflow-hidden animate-fade-in">
          {/* Animación de confeti al ganar recompensa */}
          {ecoRewardVisible && ecoReward && (
            <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1749495577/6ob_mwjq0t.gif" alt="Confeti" className="absolute top-0 left-0 w-full h-32 object-cover pointer-events-none animate-bounce-in" style={{zIndex:1}} />
          )}
          <h2 className="text-3xl font-extrabold mb-4 text-green-700 drop-shadow-lg flex items-center gap-2 animate-bounce-in">
            <svg className="w-8 h-8 text-emerald-500 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" stroke="currentColor" fill="none" /><path d="M12 6v6l4 2" strokeWidth="2" stroke="currentColor" fill="none" /></svg>
            Mi EcoCuenta
          </h2>
          <div className="flex flex-col items-center gap-2 w-full">
            <span className="text-6xl font-extrabold text-green-600 drop-shadow-lg animate-grow">{ecoCreditos}</span>
            <span className="text-gray-700 font-semibold text-lg tracking-wide">EcoCreditos acumulados</span>
            {/* Barra de progreso visual */}
            <div className="w-full max-w-xs mt-4 mb-2">
              <div className="h-4 bg-green-200 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-700" style={{ width: `${Math.min(ecoCreditos, 50) * 2}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-green-700 font-bold mt-1">
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
              <span className="text-green-700 font-semibold mt-2">Progreso hacia tu recompensa</span>
            </div>
          </div>
        </div>
      )}
      {/* Sección Mi Perfil (sin duplicar Mi EcoCuenta) */}
      {activeTab === 'perfil' && (
        <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6 flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4">Mi Perfil</h2>
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
            <div className="w-full flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700" htmlFor="name">Nombre</label>
                  <input
                    type="text"
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-400 focus:outline-none"
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
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-400 focus:outline-none"
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
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-400 focus:outline-none"
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
                    className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-400 focus:outline-none"
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
                  className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-400 focus:outline-none resize-none"
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
                  className="mt-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-400 focus:outline-none"
                  placeholder="Separados por comas"
                />
              </div>
              <button
                type="submit"
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-400 focus:outline-none shadow-md transition-all duration-200"
              >
                Actualizar Perfil
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal de calificación de reciclador, SIEMPRE disponible */}
      {showRatingsModal && ratingsModalTarget && (
        <RecyclerRatingsModal
          recyclerId={ratingsModalTarget.recyclerId}
          recyclerName={ratingsModalTarget.recyclerName}
          avatarUrl={ratingsModalTarget.avatarUrl}
          open={showRatingsModal}
          onClose={() => setShowRatingsModal(false)}
        />
      )}
      {showMyRecyclerRatingsModal && (
        <MyRecyclerRatingsModal
          open={!!showMyRecyclerRatingsModal}
          onClose={() => setShowMyRecyclerRatingsModal(false)}
          recyclerId={showMyRecyclerRatingsModal.recyclerId}
          recyclerName={showMyRecyclerRatingsModal.recyclerName}
          avatarUrl={showMyRecyclerRatingsModal.avatarUrl}
        />
      )}
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
            <h2 className="text-2xl font-bold mb-4 text-green-700 text-center">Historial de Movimientos</h2>
            <div className="space-y-8 w-full">
              {/* Puntos Creados */}
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-2 text-center">Puntos Creados</h3>
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
                        <span className="text-gray-500 text-xs">{p.claim && p.claim.pickup_time ? new Date(p.claim.pickup_time).toLocaleString('es-AR') : ''}</span>
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
                        <span className="text-gray-500 text-xs">{p.claim && p.claim.pickup_time ? new Date(p.claim.pickup_time).toLocaleString('es-AR') : ''}</span>
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
                        <span className="text-gray-500 text-xs">{p.claim && p.claim.pickup_time ? new Date(p.claim.pickup_time).toLocaleString('es-AR') : ''}</span>
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
                <X className="h-6 w-6" />
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
