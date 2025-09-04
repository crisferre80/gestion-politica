/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Calendar, Phone, Mail, MapIcon, X } from 'lucide-react';
import { supabase, type concentrationPoint } from '../lib/supabase.js';
import Map from '../components/Map.js';
import { useUser } from '../context/UserContext.js';
import NotificationBell from '../components/NotificationBell.js';
import HeaderRecycler from '../components/HeaderRecycler.js';
import { prepareImageForUpload, transformImage } from '../services/ImageTransformService.js';
import PhotoCapture from '../components/PhotoCapture.js';
import ChatList from '../components/ChatList.js';
import { getChatPreviews } from '../lib/chatUtils.js';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Importar funciones de prueba para debugging
import '../utils/testAvatarUpload.js';
import { getAvatarUrl } from '../utils/feedbackHelper.js';

interface EventNotification {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

const DashboardReferente = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<concentrationPoint | null>(null);

  // Estado para el cambio de vista
  const [view, setViewState] = useState('puntos');

  const [barrioPoints, setBarrioPoints] = useState<concentrationPoint[]>([]);
  const [, setDirigentePoints] = useState<concentrationPoint[]>([]);
  const [, setConcentrationPoints] = useState<concentrationPoint[]>([]);

  // Location and distance filtering
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // UI state
  // (el estado vacío fue removido porque causaba una advertencia de ESLint no-empty-pattern)

  // --- Chats y notificaciones ---
  const [showChatModal, setShowChatModal] = useState(false);
  const [loadingChats] = useState<boolean>(false);
  interface ChatPreview {
    id: string;
    user_id: string;
    dirigente_id?: string;
    name?: string;
    avatar_url?: string;
  lastMessage?: { content: string; created_at: string | number | Date };
    unreadCount?: number;
  }
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [eventNotifications] = useState<EventNotification[]>([]);

  // Función para cargar datos (memoizada para evitar re-creación en cada render)
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const userId = user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      // Helper local para consultas seguras: si la tabla no existe o hay 400/404,
      // devolvemos array vacío y registramos el error.
      const safeSelect = async (table: string, queryBuilder?: (qb: any) => any) => {
        try {
          let qb = supabase.from(table).select('*');
          if (queryBuilder) qb = queryBuilder(qb);
          const { data, error } = await qb;
          if (error) {
            console.warn(`[safeSelect] Error consultando ${table}:`, error);
            return [] as any[];
          }
          return data || [];
        } catch (err) {
          console.error(`[safeSelect] Excepción consultando ${table}:`, err);
          return [] as any[];
        }
      };

  // Obtener puntos de barrio: puntos disponibles para que el referente los vea
  // Antes se filtraba por el user_id del referente (mostraba solo puntos creados por él).
  // Ahora traemos los puntos con status = 'available' para la pestaña "Disponibles".
  const barrioPointsRaw = await safeSelect('concentration_points', (qb: any) => qb.eq('status', 'available'));
  console.log('[DashboardReferente] fetched barrioPointsRaw count:', (barrioPointsRaw || []).length);

  // Obtener puntos de concentración (todos) para usos internos y para detectar puntos creados por dirigentes
  const concentrationPointsRaw = await safeSelect('concentration_points');
  console.log('[DashboardReferente] fetched concentrationPointsRaw count:', (concentrationPointsRaw || []).length);

      // Obtener perfiles de usuarios para mostrar información completa
      // Tomamos los user_ids tanto de los puntos de barrio y concentración filtrados como de todos los puntos
  const allPoints = [...(barrioPointsRaw || []), ...(concentrationPointsRaw || [])];
      // Además obtener todos los concentration_points para luego filtrar los creados por dirigentes
  const allConcentrationPoints = await safeSelect('concentration_points');
  console.log('[DashboardReferente] fetched allConcentrationPoints count:', (allConcentrationPoints || []).length);
  const allUserIds = [...new Set([...allPoints.map((p: any) => p.user_id), ...(allConcentrationPoints || []).map((p: any) => p.user_id)])];
  console.log('[DashboardReferente] allUserIds:', allUserIds);
      let profilesById: Record<string, any> = {};

      // Normalizador de claves para evitar mismatches entre 'id' y 'user_id'.
      const normalizeKey = (v?: any) => (v == null ? '' : String(v).toLowerCase());

      // Construye un índice seguro a partir del array de perfiles. Indexa por
      // user_id, id y por email (fallback). Retorna un map { normalizedKey: profile }
      const buildProfilesIndex = (profilesArray: any[] | null | undefined) => {
        const map: Record<string, any> = {};
        if (!Array.isArray(profilesArray) || profilesArray.length === 0) return map;
        for (const p of profilesArray) {
          const kUser = normalizeKey(p?.user_id);
          const kId = normalizeKey(p?.id);
          if (kUser) map[kUser] = p;
          if (kId) map[kId] = p;
          if (p?.email) map[normalizeKey(p.email)] = p;
        }
        return map;
      };

      // Helper que intenta resolver el perfil de un punto usando el índice local
      // y si no lo encuentra hace una consulta puntual via resolveProfileRow.
      const lookupProfileForPoint = async (pointUserId: any, allProfilesArray?: any[]) => {
        const key = normalizeKey(pointUserId);
        if (!key) return null;
        // Intenta llave rápida en el índice
        let found = profilesById[key];
        // Si no está y tenemos el array completo, intentar un match por scanning
        if (!found && Array.isArray(allProfilesArray)) {
          found = allProfilesArray.find((pr: any) => {
            const ku = normalizeKey(pr?.user_id);
            const ki = normalizeKey(pr?.id);
            return ku === key || ki === key || normalizeKey(pr?.email) === key;
          }) || null;
        }
        // Si aún no hay resultado, caer a la query puntual
        if (!found) {
          try {
            found = await resolveProfileRow(pointUserId);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            found = null;
          }
        }
        return found || null;
      };

      // si ya se cargaron los perfiles en la variable `profiles` (fetch anterior),
      // construimos el índice. Si tu código usa otro nombre, este build no rompe nada.
      // Hacemos 'possibleProfiles' accesible fuera del try para poder usarlo
      // más abajo al resolver puntos individualmente.
       
      let possibleProfiles: any = undefined;
      try {
        // Intentar usar variable local 'profiles' si existe
         
        possibleProfiles = undefined;
        if (Array.isArray(possibleProfiles)) {
          profilesById = buildProfilesIndex(possibleProfiles);
        }
      } catch {
        // noop
      }

      // Si el índice quedó vacío, intentar hacer una consulta puntual por los user_ids
      // recolectados para poblar el índice y así evitar referencias a variables
      // intermedias inexistentes en el scope.
      try {
        if ((!profilesById || Object.keys(profilesById).length === 0) && Array.isArray(allUserIds) && allUserIds.length > 0) {
          // Intentar obtener perfiles en lote
          let fetchedProfiles: any[] = [];
          try {
            // Diagnostic fetch: call PostgREST directly to capture raw response when .in() fails
            try {
              const baseUrl = import.meta.env.VITE_SUPABASE_URL;
              const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
              if (baseUrl && anonKey) {
                const select = encodeURIComponent('id,user_id,name,avatar_url,lat,lng,role,bio,materials,rating_average,total_ratings');
                const inList = allUserIds.join(',');
                const diagUrl = `${baseUrl}/rest/v1/profiles?select=${select}&user_id=in.(${encodeURIComponent(inList)})`;
                try {
                  const diagRes = await fetch(diagUrl, {
                    headers: {
                      apikey: anonKey,
                      Authorization: `Bearer ${anonKey}`,
                    },
                    credentials: 'omit'
                  });
                  let bodyText = '';
                  try { bodyText = await diagRes.text(); } catch (e) { bodyText = String(e); }
                  console.log('[DashboardReferente][diag] direct REST fetch to profiles status:', diagRes.status, 'body:', bodyText);
                } catch (diagErr) {
                  console.warn('[DashboardReferente][diag] direct REST fetch failed:', diagErr);
                }
              }
            } catch (diagErr) {
              console.warn('[DashboardReferente][diag] error building diag request:', diagErr);
            }

            fetchedProfiles = await safeSelect('profiles', (qb: any) => qb.in('user_id', allUserIds));
            console.log('[DashboardReferente] fetchedProfiles count:', (fetchedProfiles || []).length);
          } catch (err) {
            console.warn('[DashboardReferente] safeSelect(in) fallo:', err);
            fetchedProfiles = [];
          }

          // Si no encontramos perfiles con la consulta en lote, intentar consultas individuales
          if (!Array.isArray(fetchedProfiles) || fetchedProfiles.length === 0) {
            console.log('[DashboardReferente] fetchedProfiles vacío, intentando consultas individuales por user_id...');
            const resolvedList = await Promise.all(allUserIds.map(async (uid) => {
              try {
                const r = await resolveProfileRow(uid);
                if (!r) console.warn('[DashboardReferente] resolveProfileRow devolvió null para', uid);
                return r;
              } catch (e) {
                console.warn('[DashboardReferente] resolveProfileRow error para', uid, e);
                return null;
              }
            }));
            const nonNull = (resolvedList || []).filter(Boolean);
            if (nonNull.length > 0) {
              fetchedProfiles = nonNull as any[];
            }
          }

          if (Array.isArray(fetchedProfiles) && fetchedProfiles.length > 0) {
            profilesById = buildProfilesIndex(fetchedProfiles);
            possibleProfiles = fetchedProfiles;
          }
        }
        console.log('[DashboardReferente] profilesById keys:', Object.keys(profilesById || {}));
      } catch {
        // noop
      }

      // Procesar puntos de barrio (usar lookup centralizada que normaliza y hace fallback)
      const processedBarrioPoints = await Promise.all((barrioPointsRaw || []).map(async (point: any) => {
        const resolved = await lookupProfileForPoint(point.user_id, possibleProfiles || Object.values(profilesById));
        // eslint-disable-next-line no-empty
        try { console.log('[DashboardReferente] barrio point resolution', { pointId: point.id, pointUserId: point.user_id, resolvedId: resolved?.id, resolvedUserId: resolved?.user_id, resolvedRole: resolved?.role }); } catch {}
        return {
          ...point,
          creator_name: resolved?.name || 'Usuario Anónimo',
          creator_email: resolved?.email,
          creator_phone: resolved?.phone,
          creator_avatar: resolved?.avatar_url,
          creator_dni: resolved?.dni,
          profiles: resolved,
          materials: Array.isArray(point.materials) ? point.materials : [point.materials].filter(Boolean),
        };
      }));

      // Procesar puntos de concentración (usar lookup centralizada)
      const processedConcentrationPoints = await Promise.all((concentrationPointsRaw || []).map(async (point: any) => {
        const resolved = await lookupProfileForPoint(point.user_id, possibleProfiles || Object.values(profilesById));
        // eslint-disable-next-line no-empty
        try { console.log('[DashboardReferente] concentration point resolution', { pointId: point.id, pointUserId: point.user_id, resolvedId: resolved?.id, resolvedUserId: resolved?.user_id, resolvedRole: resolved?.role }); } catch {}
        return {
          ...point,
          creator_name: resolved?.name || 'Usuario Anónimo',
          creator_email: resolved?.email,
          creator_phone: resolved?.phone,
          creator_avatar: resolved?.avatar_url,
          creator_dni: resolved?.dni,
          profiles: resolved,
        };
      }));

  console.log('[DashboardReferente] processedBarrioPoints count:', (processedBarrioPoints || []).length);
  console.log('[DashboardReferente] processedConcentrationPoints count:', (processedConcentrationPoints || []).length);
  setBarrioPoints(processedBarrioPoints);
  setConcentrationPoints(processedConcentrationPoints);
      // Procesar puntos creados por dirigentes
      const processedDirigentePoints = await Promise.all((allConcentrationPoints || []).map(async (point: any) => {
        // Intentar resolver el perfil del creador del punto usando índice y fallback.
        const resolved = await lookupProfileForPoint(point.user_id, possibleProfiles);
        try {
          console.log('[DashboardReferente] point resolution', { pointId: point.id, pointUserId: point.user_id, resolvedId: resolved?.id, resolvedUserId: resolved?.user_id, resolvedRole: resolved?.role });
    } catch { /* noop */ }
        return { ...point, profiles: resolved };
      }));
      // Filtrar solo los creados por dirigentes
  console.log('[DashboardReferente] processedDirigentePoints count before filter:', (processedDirigentePoints || []).length);
  setDirigentePoints(processedDirigentePoints.filter(p => p.profiles?.type === 'dirigente'));
  setLoading(false);
    } catch (err) {
      console.error('Error en fetchData:', err);
      setError('Error al cargar los datos');
      setLoading(false);
    }
  }, [user]);

  // Helper: resuelve la fila de profiles para un user_id y devuelve la fila completa.
  // Usar esto evita asumir que existe una columna 'id'.
  const resolveProfileRow = async (userId: string) => {
    if (!userId) return null;
    try {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.warn('resolveProfileRow supabase error:', error);
        return null;
      }
      return row || null;
    } catch (e) {
      console.error('resolveProfileRow exception:', e);
      return null;
    }
  };

  // Inicialización de Supabase y carga de datos
  useEffect(() => {
    if (!user) return;
    
    const init = async () => {
      try {
        setLoading(true);
        // Verificar la configuración de Supabase
        const { initializeSupabase } = await import('../lib/supabase.js');
        const initialized = await initializeSupabase();
        
        if (!initialized) {
          console.error('No se pudo inicializar correctamente la conexión con Supabase');
          setError('Error de conexión con la base de datos. Por favor, contacta al administrador.');
          setLoading(false);
          return;
        }
        
        // Cargar los datos
        await fetchData();
        setLoading(false);
      } catch (error) {
        console.error('Error en la inicialización:', error);
        setError('Error al inicializar la aplicación. Por favor, recarga la página.');
        setLoading(false);
      }
    };
    
    init();
  }, [user, fetchData]);

  // Abrir modal para programar recolección
  // Abrir modal/mapa para ver un punto
  const handleOpenPickupModal = (point: concentrationPoint) => {
    // Reemplazamos la lógica de "claim" por abrir el punto en el mapa
    setSelectedPoint(point);
    setShowMap(true);
    setError(null);
  };

  // Función para calcular distancia (km) entre dos coordenadas (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => v * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Obtener la ubicación del usuario y manejar estado asociado
  const getUserLocation = async () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocalización no disponible en este navegador');
      return;
    }
    setGettingLocation(true);
    setLocationError(null);
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGettingLocation(false);
          resolve();
        },
        (err) => {
          setLocationError(err.message || 'Error obteniendo ubicación');
          setGettingLocation(false);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Nota: la inicialización se ejecuta en el otro useEffect (más arriba). No duplicamos la lógica.

  // --- PRESENCIA EN TIEMPO REAL ---
  useEffect(() => {
  if (!user?.id) return;
    // Marcar online al entrar
    // Evitar actualizar por user_id en una sola llamada REST que puede generar
    // rutas tipo /profiles?user_id=eq.<uuid> y 400 en algunos endpoints.
    (async () => {
      try {
        const profileRow = await resolveProfileRow(user.id);
        if (profileRow) {
          const key = 'id' in profileRow ? 'id' : 'user_id';
          const value = profileRow[key as keyof typeof profileRow];
          await supabase.from('profiles').update({ online: true }).eq(key, value as any);
        }
      } catch (e) {
        console.warn('No se pudo marcar online en profiles:', e);
      }
    })();
    // Timer de inactividad: 60 minutos
    let inactivityTimeout: NodeJS.Timeout | null = null;
    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(async () => {
        try {
          const profileRow = await resolveProfileRow(user.id);
          if (profileRow) {
            const key = 'id' in profileRow ? 'id' : 'user_id';
            const value = profileRow[key as keyof typeof profileRow];
            await supabase.from('profiles').update({ online: false }).eq(key, value as any);
          }
        } catch (e) {
          console.warn('No se pudo marcar offline en profiles:', e);
        }
        window.location.href = '/login';
      }, 60 * 60 * 1000); // 60 minutos
    };
    // Eventos de actividad
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
    };
  }, [user]);

  useEffect(() => {
    const handleUnload = async () => {
      if (!user?.id) return;
      try {
        const profileRow = await resolveProfileRow(user.id);
        if (profileRow) {
          const key = 'id' in profileRow ? 'id' : 'user_id';
          const value = profileRow[key as keyof typeof profileRow];
          await supabase.from('profiles').update({ online: false }).eq(key, value as any);
        }
        } catch {
        // Ignorar errores en unload
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  // Escucha en tiempo real los mensajes recibidos
  // Escucha en tiempo real los mensajes recibidos
  // (Eliminado el manejo de unreadChats por no ser usado)
  // Actualización automática de ubicación cada 30 segundos
  useEffect(() => {
    if (!user?.id) return;
    const updateLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
              const profileRow = await resolveProfileRow(user.id);
              if (profileRow) {
                const key = 'id' in profileRow ? 'id' : 'user_id';
                const value = profileRow[key as keyof typeof profileRow];
                await supabase.from('profiles').update({ lat, lng }).eq(key, value as any);
              }
            } catch {
              console.warn('Error actualizando ubicación del perfil');
            }
          }
        );
      }
    };
    updateLocation(); // Actualiza al cargar
    const intervalId = setInterval(updateLocation, 30000); // Cada 30 segundos
    return () => clearInterval(intervalId);
  }, [user]);

  // Suscripción en tiempo real a concentration_points para actualización instantánea
  useEffect(() => {
  if (!user?.id) return;
    
  // Suscripción a concentration_points con debounce para evitar actualizaciones excesivas
    const channelPoints = supabase.channel('referent-concentration-points')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
  table: 'concentration_points',
      }, () => {
        // Usar un pequeño delay para evitar actualizaciones demasiado frecuentes
        setTimeout(() => {
          fetchData();
        }, 500);
      });
      
    // Activar canal
    channelPoints.subscribe();
    
    return () => {
      supabase.removeChannel(channelPoints);
    };
  }, [user, fetchData]);

  // Suscripción en tiempo real a mensajes para actualizar badge de mensajes no leídos
  useEffect(() => {
    if (!user?.id) return;
    // Suscribirse a cambios donde el usuario es sender
    const channelSender = supabase.channel('recycler-messages-badge-sender')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
  filter: `sender_id=eq.${user?.id}`,
      }, async () => {
        try {
          const { data: messages, error } = await supabase
            .from('messages')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);
          if (error) throw error;
          const otherUserIds = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user?.id)));
          const previews = await getChatPreviews(user?.id || '', otherUserIds);
          setChatPreviews(previews.map(p => ({
            id: p.userId,
            user_id: p.userId,
            recycler_id: user.id,
            name: p.name,
            avatar_url: p.avatar_url,
            lastMessage: p.lastMessage,
            unreadCount: p.unreadCount
          })));
        } catch {
          setChatPreviews([]);
        }
      });
    // Suscribirse a cambios donde el usuario es receiver
    const channelReceiver = supabase.channel('recycler-messages-badge-receiver')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
  filter: `receiver_id=eq.${user?.id}`,
      }, async () => {
        try {
          const { data: messages, error } = await supabase
            .from('messages')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);
          if (error) throw error;
          const otherUserIds = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user?.id)));
          const previews = await getChatPreviews(user?.id || '', otherUserIds);
          setChatPreviews(previews.map(p => ({
            id: p.userId,
            user_id: p.userId,
            recycler_id: user.id,
            name: p.name,
            avatar_url: p.avatar_url,
            lastMessage: p.lastMessage,
            unreadCount: p.unreadCount
          })));
        } catch {
          setChatPreviews([]);
        }
      });
    channelSender.subscribe();
    channelReceiver.subscribe();
    return () => {
      supabase.removeChannel(channelSender);
      supabase.removeChannel(channelReceiver);
    };
  }, [user]);

  // Eliminamos la función local y usamos la centralizada desde feedbackHelper
  // Esta línea se conserva solo para documentación, pero no tiene efecto
  // La función anterior solo reemplazaba rutas internas, pero no manejaba casos cuando no hay URL

  // --- MODALES Y ESTADOS PARA ACCIONES DEL HEADER ---
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // El efecto que manejaba profileId fue retirado porque la aplicación ya no usa
  // un state local profileId en este componente tras la eliminación del modal
  // de ratings. Si en el futuro se necesita acceder al id del perfil interno,
  // usar user.profileId (desde el contexto) o reintroducir un estado con uso.

  // --- COMPONENTE EditProfileForm ---
  // Define un tipo local para el perfil completo del reciclador (eliminado porque no se usa)

  interface EditProfileFormProps {
    onClose: () => void;
    onProfileUpdated: () => void;
  }

  const EditProfileForm: React.FC<EditProfileFormProps> = ({ onClose, onProfileUpdated }) => {
    const { user: globalUser, login: updateUser } = useUser(); // Para actualizar el contexto global
    const [form, setForm] = React.useState({
      name: globalUser?.name || '',
      email: globalUser?.email || '',
      phone: globalUser?.phone || '',
      address: globalUser?.address || '',
      bio: globalUser?.bio || '',
      avatar_url: globalUser?.avatar_url || '',
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);

    // Función local para subir avatar (igual que en DashboardDirigente)
    async function uploadAvatar(file: File, userId: string): Promise<string | null> {
      if (!file || !userId) return null;
      
      try {
        // Paso 1: Procesar la imagen para asegurar que no exceda los 300 KB
        console.log('[uploadAvatar] Procesando imagen con límite de 300KB');
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
  // Subir en la raíz del bucket o en la subcarpeta manejada por el helper central.
  const filePath = fileName; // no prefix to avoid duplicating 'avatares/'
        
        // Verificar tamaño final
        const finalSizeKB = Math.round(processedBlob.size/1024);
        console.log('[uploadAvatar] fileName:', fileName, 'fileType:', processedFile.type, 'size:', finalSizeKB + 'KB');
        
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

    // Sincronizar formulario cuando cambia el usuario
    React.useEffect(() => {
      if (globalUser) {
        setForm({
          name: globalUser?.name || '',
          email: globalUser?.email || '',
          phone: globalUser?.phone || '',
          address: globalUser?.address || '',
          bio: globalUser?.bio || '',
          avatar_url: globalUser?.avatar_url || '',
        });
      }
    }, [globalUser]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        if (!globalUser) {
          throw new Error('Usuario no encontrado');
        }
        
        // Preparar datos de actualización (solo campos que han cambiado)
        const updateData: Record<string, string | null> = {};
        
        if (form.name !== globalUser?.name) updateData.name = form.name;
        if (form.email !== globalUser?.email) updateData.email = form.email;
        if (form.phone !== globalUser?.phone) updateData.phone = form.phone;
        if (form.address !== globalUser?.address) updateData.address = form.address;
        if (form.bio !== globalUser?.bio) updateData.bio = form.bio;
        if (form.avatar_url !== globalUser?.avatar_url) updateData.avatar_url = form.avatar_url;
        
        // Solo actualizar si hay cambios
        if (Object.keys(updateData).length > 0) {
          // Obtener el id interno del perfil y actualizar por PK `id` para evitar errores con REST y RLS
          // Resolver la fila del perfil y actualizar por la clave disponible
          const profileRow = await resolveProfileRow(globalUser.id);
          if (!profileRow) throw new Error('Perfil no encontrado para actualizar');
          const key = 'id' in profileRow ? 'id' : 'user_id';
          const value = profileRow[key as keyof typeof profileRow];
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq(key, value as any);

          if (updateError) throw updateError;
          console.log('Perfil actualizado en BD:', updateData);
        }
        
        // Obtener el perfil actualizado y actualizar el contexto global
        // Obtener la fila del perfil (usar resolveProfileRow para evitar suposiciones)
        const profileRow2 = await resolveProfileRow(globalUser.id);
        if (!profileRow2) throw new Error('Perfil no encontrado después de actualizar');
        const key2 = 'id' in profileRow2 ? 'id' : 'user_id';
        const value2 = profileRow2[key2 as keyof typeof profileRow2];
        const { data: updatedProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq(key2, value2 as any)
          .single();

        if (fetchError) throw fetchError;
        
        if (updatedProfile) {
          // No forzamos el `type`/`role` aquí: mantenemos los valores existentes
          // y solo actualizamos con los campos devueltos por la BD.
          const updatedUser = {
            ...globalUser,
            ...updatedProfile,
          };

          console.log('Actualizando contexto con:', updatedUser);
          updateUser(updatedUser);
          
          // Actualizar el formulario con los datos reales de la BD
          setForm({
            name: updatedProfile.name || '',
            email: updatedProfile.email || '',
            phone: updatedProfile.phone || '',
            address: updatedProfile.address || '',
            bio: updatedProfile.bio || '',
            avatar_url: updatedProfile.avatar_url || '',
          });
        }
        
        setSuccess(true);
        toast.success('Perfil actualizado exitosamente');
        setTimeout(() => {
          setSuccess(false);
          onProfileUpdated();
        }, 1200);
      } catch (err) {
        console.error('Error al actualizar perfil:', err);
        setError((err as Error).message || 'Error al actualizar el perfil');
      } finally {
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-blue-400 bg-white">
            <img 
              src={form.avatar_url || '/default-avatar.png'} 
              alt="Avatar" 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/default-avatar.png';
              }}
            />
          </div>
          
          {/* PhotoCapture igual que en DashboardDirigente */}
          <PhotoCapture
            aspectRatio="square"
            onCapture={async (file) => {
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
                if (!globalUser) {
                  setError('Usuario no encontrado.');
                  return;
                }
                // Subir el avatar y obtener la URL
                const url = await uploadAvatar(file, globalUser.id);
                if (!url) {
                  setError('Error al subir la imagen.');
                  return;
                }
                // Actualizar el perfil en Supabase: obtener primero id interno para evitar 400
                const profileRow3 = await resolveProfileRow(globalUser.id);
                if (!profileRow3) {
                  setError('Perfil no encontrado para actualizar la foto.');
                  return;
                }
                const key3 = 'id' in profileRow3 ? 'id' : 'user_id';
                const value3 = profileRow3[key3 as keyof typeof profileRow3];
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ avatar_url: url })
                  .eq(key3, value3 as any);
                if (updateError) {
                  setError('Error al actualizar el perfil con la nueva foto.');
                  console.error(updateError);
                  return;
                }
                // Actualizar el estado local del usuario y formulario
                console.log('Avatar subido exitosamente:', url);
                updateUser({
                  ...globalUser,
                  avatar_url: url
                });
                setForm({ ...form, avatar_url: url });
                toast.success('Foto de perfil actualizada correctamente');
              } catch (e) {
                setError('Error inesperado al subir la foto.');
                console.error(e);
              }
            }}
            onCancel={() => {}}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre</label>
          <input name="name" value={form.name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Teléfono</label>
          <input name="phone" value={form.phone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Dirección</label>
          <input name="address" value={form.address} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" rows={2} />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-blue-600 text-sm">¡Perfil actualizado!</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow">
            {loading ? 'Actualizando...' : 'Actualizar perfil'}
          </button>
        </div>
      </form>
    );
  };

  // Rutas eliminadas: el panel de Referente no gestiona rutas ahora.

  const [showAllPointsMap, setShowAllPointsMap] = useState(false);
  // --- Dirigentes (mover lógica desde DashboardDirigente) ---
  type Recycler = {
    role: string;
    id: string;
    user_id?: string;
    profiles?: { avatar_url?: string; name?: string; email?: string; phone?: string; dni?: string };
    rating_average?: number;
    total_ratings?: number;
    materials?: string[];
    bio?: string;
    lat?: number;
    lng?: number;
    online?: boolean;
  };

  const [recyclers, setRecyclers] = useState<Recycler[]>(() => {
    const cached = sessionStorage.getItem('recyclers_online');
    if (cached) {
      try { return JSON.parse(cached); } catch { return []; }
    }
    return [];
  });

  const [mapFitBounds, setMapFitBounds] = useState<[[number, number],[number, number]] | null>(null);
  const [mapCenterToUser] = useState<boolean>(false);

  const fetchOnlineRecyclers = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      // Use select('*') to avoid referencing a non-existent 'id' column in some DBs
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'referente')
        .limit(500);
      if (!error && data) {
        const normalized: Recycler[] = (data as any[]).map(d => ({
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
      console.warn('[fetchOnlineRecyclers] Error:', err);
    }
  }, [user]);

  useEffect(() => { sessionStorage.setItem('recyclers_online', JSON.stringify(recyclers)); }, [recyclers]);

  useEffect(() => {
    let isMounted = true;
    (async () => { await fetchOnlineRecyclers(); })();
    const createRecyclersSubscription = () => {
      const channelName = `recyclers-profiles`;
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false }, presence: { key: 'recyclers' } }
      })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: "role=eq.referente" }, () => {
        if (!isMounted) return; fetchOnlineRecyclers();
      })
      .subscribe();
      return channel;
    };
    const channel = createRecyclersSubscription();
    const interval = setInterval(() => { if (isMounted) fetchOnlineRecyclers(); }, 5000);
    return () => { isMounted = false; supabase.removeChannel(channel); clearInterval(interval); };
  }, [fetchOnlineRecyclers]);

  // Si necesitas rutas en el futuro, descomenta y usa estas líneas.

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Debes iniciar sesión para ver esta página</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Cargando...</p>
      </div>
    );
  }

  // Usar puntos de barrio disponibles
  let availablePoints = barrioPoints;
  
  // Aplicar filtro de distancia si está habilitado
  if (userLocation && maxDistance) {
    availablePoints = availablePoints.filter(point => {
      // Verificar que el punto tenga coordenadas válidas
      if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
        return true; // Incluir puntos sin coordenadas para evitar excluir puntos válidos
      }
      
      const distance = calculateDistance(
        userLocation.lat, 
        userLocation.lng, 
        point.lat, 
        point.lng
      );
      
      // Agregar la distancia calculada al punto para mostrarla en la UI
      (point as concentrationPoint & { calculatedDistance?: number }).calculatedDistance = distance;
      
      return distance <= maxDistance;

    });
  }

  // Handler para cambio de vista que limpia el Dirigente enfocado
  const handleSetView = (newView: string) => {
    setViewState(newView);
  };

  // Muestra un mensaje claro en español si el error es 'The object exceeded the maximum allowed size', indicando que el archivo es demasiado grande.
  if (error && (error.includes('The object exceeded the maximum allowed size') || error.includes('exceeded the maximum allowed size'))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">La imagen o archivo que intentaste subir es demasiado grande. Por favor, selecciona una imagen más liviana (menor a 2MB) e inténtalo nuevamente.</p>
        </div>
      </div>
    );
  }

// (Eliminada la función handleClearCompletedPoints porque no se utiliza)

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <HeaderRecycler />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mostrar errores de forma prominente */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p className="whitespace-pre-line">{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setError(null);
                      // Intentar recargar datos si el error persiste
                      if (error.includes('recarga la página')) {
                        window.location.reload();
                      }
                    }}
                    className="bg-red-100 px-3 py-1 rounded text-red-800 text-sm hover:bg-red-200 transition-colors"
                  >
                    Cerrar
                  </button>
                  {error.includes('recarga la página') && (
                    <button
                      onClick={() => window.location.reload()}
                      className="ml-2 bg-red-600 px-3 py-1 rounded text-white text-sm hover:bg-red-700 transition-colors"
                    >
                      Recargar página
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

  {/* El mapa se mostrará debajo del header cuando se active (ver botón 'Mapa') */}
  {/* Sección 'Puntos creados por Dirigentes' eliminada */}
        {/* --- FIN MAPA --- */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h1 className="text-3xl font-bold text-blue-800">Panel del Referente</h1>
          <div className="flex items-center gap-4">
            <span className="inline-block px-3 py-1 rounded-full bg-blue-200 text-blue-800 text-xs font-semibold tracking-wide">Referente</span>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header profesional del reciclador */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-8 py-8 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex-shrink-0">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-blue-400 bg-white shadow">
                <img src={getAvatarUrl(user?.avatar_url, user?.name)} alt="Foto de perfil" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-1">{user?.name || 'Reciclador'}</h1>
                  {user?.online ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-semibold ml-2 animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full mr-1"></span>En Línea
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-300 text-gray-600 text-xs font-semibold ml-2">
                      <span className="w-2 h-2 bg-gray-100 rounded-full mr-1"></span>Desconectado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <NotificationBell />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-gray-700 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span>{user?.email}</span>
                </div>
                {user?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-500" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user?.address && (
                  <div className="flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-blue-500" />
                    <span>{user.address}</span>
                  </div>
                )}
              </div>
              {user?.bio && (
                <div className="mt-3 text-gray-600 text-sm italic max-w-2xl">{user.bio}</div>
              )}
              {/* Botones de acción del header: sin carrusel, solo fila responsiva */}
              <div className="mt-4 w-full">
                <div className="flex flex-wrap gap-3 md:gap-4 justify-start">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow"
                    onClick={() => setShowEditProfileModal(true)}
                  >
                    Editar Perfil
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow"
                    onClick={() => navigate('/estadisticas')}
                  >
                    Ver Estadísticas
                  </button>
                  {/* calificaciones removed */}
                  <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-yellow-600 font-semibold shadow flex items-center gap-2 relative"
                    onClick={() => setShowChatModal(true)}
                    // disabled={!canChatWithdirigente}
                    // title={canChatWithdirigente ? "Abrir chat con Dirigente" : "Solo disponible si el Dirigente habilita el chat"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8l-4.28 1.07A1 1 0 013 19.13V17.6c0-.29.13-.56.35-.74A7.97 7.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Mensajes
                    {(() => {
                      const unreadTotal = chatPreviews.reduce((acc, chat) => acc + (typeof chat.unreadCount === 'number' ? chat.unreadCount : 0), 0);
                      console.log('[BADGE DEBUG] chatPreviews:', chatPreviews);
                      console.log('[BADGE DEBUG] unreadTotal:', unreadTotal);
                      if (unreadTotal > 0) {
                        return (
                          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold shadow-lg border-2 border-white animate-pulse z-10">
                            {unreadTotal}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </button>
                  <button
                    onClick={() => setShowAllPointsMap(v => !v)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow flex items-center gap-2 text-sm"
                    title="Mostrar mapa"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.382V7.618a2 2 0 011.553-1.894L9 3m0 17l6-3m-6 3V3m6 3l5.447 2.724A2 2 0 0121 8.618v7.764a2 2 0 01-1.553 1.894L15 20z" /></svg>
                    Mapa
                  </button>
                  {/* Botón 'Mis Rutas' eliminado para referentes */}
                </div>
              </div>
            </div>
          </div>

          {showAllPointsMap && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2 mb-3">
                <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414a4 4 0 10-1.414 1.414l4.243 4.243a1 1 0 001.414-1.414z" /></svg>
                Mapa de Centros de Movilizaciòn
              </h2>
              <div id="dirigente-points-map" className="w-full h-96 rounded-lg overflow-hidden border border-blue-300 shadow mb-2 animate-fade-in">
                <Map
                  markers={availablePoints.map(p => ({
                    id: p.id,
                    lat: Number(p.lat),
                    lng: Number(p.lng),
                    title: p.address,
                    avatar_url: p.creator_avatar || undefined,
                    iconUrl: 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1756996529/logo_cm_pj_ijx3oh.png',
                    status: 'disponible',
                    iconsize: [40, 40]
                  }))}
                  showUserLocation={true}
                  showAdminZonesButton={false}
                  hideDrawControls={true}
                  onMarkerClick={(id) => {
                    // Abrir la pestaña de Centros si está cerrada y mostrar el mapa/lista
                    setViewState('disponibles');
                    setShowAllPointsMap(true);
                    // Esperar un poco para que el DOM renderice la lista y luego scrollear
                    setTimeout(() => {
                      const el = document.getElementById(`point-card-${id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('ring-4', 'ring-blue-300');
                        setTimeout(() => el.classList.remove('ring-4', 'ring-blue-300'), 2200);
                      }
                    }, 350);
                  }}
                />
              </div>
            </div>
          )}

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {/* Mostrar notificaciones de eventos del Dirigente */}
            {eventNotifications.length > 0 && (
              <div className="mb-4 w-full max-w-2xl bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded relative" role="alert">
                <h4 className="font-bold mb-2">Notificaciones recientes</h4>
                <ul className="space-y-1">
                  {eventNotifications.slice(0, 5).map(ev => (
                    <li key={ev.id} className="text-sm flex items-center gap-2">
                      <span className="font-semibold">[{ev.created_at ? new Date(ev.created_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}]</span>
                      <span>{ev.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Botones para selección de vista */}
      <div className="mb-6 flex flex-wrap gap-2 justify-start md:justify-start">
              <button
                onClick={() => handleSetView('disponibles')}
                className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 min-w-[140px] text-sm
                  ${view === 'disponibles'
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'}
                `}
              >
        Ver Centros de Movilizacion
                {availablePoints.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-800 text-white rounded-full">
                    {availablePoints.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSetView('dirigentes')}
                className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 min-w-[140px] text-sm
                  ${view === 'dirigentes'
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'}
                `}
              >
                Ver Dirigentes
                {recyclers.filter(r => r.online).length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-800 text-white rounded-full">{recyclers.filter(r => r.online).length}</span>
                )}
              </button>
            </div>

            {/* Filtro de distancia para puntos disponibles */}
            {(
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Filtrar por Distancia</h3>
              <div className="flex flex-wrap items-center gap-4">
                  {/* Botón para obtener ubicación */}
                  <button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 text-sm ${
                      userLocation 
                        ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } ${gettingLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {gettingLocation ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Obteniendo ubicación...
                      </span>
                    ) : userLocation ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        Ubicación obtenida
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        Obtener mi ubicación
                      </span>
                    )}
                  </button>

                  {/* Selector de distancia máxima */}
                  {userLocation && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="maxDistance" className="text-sm font-medium text-gray-700">
                        Distancia máxima:
                      </label>
                      <select
                        id="maxDistance"
                        value={maxDistance || ''}
                        onChange={(e) => setMaxDistance(e.target.value ? Number(e.target.value) : null)}
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Sin límite</option>
                        <option value="1">1 km</option>
                        <option value="2">2 km</option>
                        <option value="5">5 km</option>
                        <option value="10">10 km</option>
                        <option value="20">20 km</option>
                        <option value="50">50 km</option>
                      </select>
                    </div>
                  )}

                  {/* Botón para limpiar filtros */}
                  {(userLocation || maxDistance) && (
                    <button
                      onClick={() => {
                        setUserLocation(null);
                        setMaxDistance(null);
                        setLocationError(null);
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>

                {/* Mensaje de error de ubicación */}
                {locationError && (
                  <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                    {locationError}
                  </div>
                )}

                {/* Información de ubicación */}
                {userLocation && (
                  <div className="mt-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-2">
                    <span className="font-medium">Ubicación:</span> {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                    {maxDistance && (
                      <span className="ml-3">
                        <span className="font-medium">Filtro:</span> Puntos a máximo {maxDistance} km de distancia
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Secciones de Mis Puntos */}
            <div>
              {view === 'disponibles' && (
                <div>
                  <h2 className="text-xl font-semibold text-blue-700 mb-4">
                    Puntos Disponibles
                    {userLocation && maxDistance && (
                      <span className="ml-3 text-sm font-normal text-blue-600">
                        (filtrados por distancia: máximo {maxDistance} km)
                      </span>
                    )}
                    {userLocation && !maxDistance && (
                      <span className="ml-3 text-sm font-normal text-blue-600">
                        (ordenados por distancia)
                      </span>
                    )}
                  </h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {availablePoints.length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">
                        No hay puntos disponibles en este momento.
                      </div>
                    ) : (
                      availablePoints.map(point => (
                        <div key={point.id} id={`point-card-${point.id}`} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-400">
                          <div className="p-6">
                            {/* Info principal */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <img
                                  src={point.type === 'colective_point'
                                    ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1756873463/iconescuela_loziof.png'
                                    : '/assets/logo%20cm%20pj.png'}
                                  alt="Punto de Recolección"
                                  className="w-12 h-12 object-contain drop-shadow-lg animate-bounce mr-1 mt-0.2"
                                />
                                <div className="min-w-0">
                                  <h3 className="text-lg font-bold text-blue-800 truncate">{point.address}</h3>
                                  <p className="mt-1 text-sm text-gray-500 truncate">{point.district || point.barrio || point.neighbourhood || 'Sin barrio'}</p>

                                  {/* Creator / Dirigente info */}
                                  <div className="mt-3 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-100 bg-white flex-shrink-0">
                                      <img
                                        src={getAvatarUrl(point.creator_avatar, typeof point.creator_name === 'string' ? point.creator_name : String(point.creator_name))}
                                        alt={typeof point.creator_name === 'string' ? point.creator_name : String(point.creator_name || 'Dirigente')}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { const t = e.target as HTMLImageElement; t.src = '/default-avatar.png'; }}
                                      />
                                    </div>
                                    <div className="text-sm truncate">
                                      <div className="font-medium text-gray-800 truncate">{point.creator_name || 'Dirigente'}</div>
                                      <div className="text-xs text-gray-500 truncate">
                                        {point.creator_name ? (
                                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{point.creator_phone}</span>
                                        ) : point.creator_email ? (
                                          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{point.creator_email}</span>
                                        ) : (
                                          <span className="italic">Sin contacto</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Botón Google Maps navegación usando coordenadas Mapbox */}
                              </div>
                            </div>
                            <div className="flex flex-row items-start mt-4">
                              <div className="mr-6 flex-shrink-0">
                                <div className="relative transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-blue-300 hover:shadow-lg rounded-lg">
                                  <img
                                    src={point.photo_url ? point.photo_url : (point.type === 'colective_point'
                                      ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1756873463/iconescuela_loziof.png'
                                      : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1756952486/Generated_Image_September_03_2025_-_11_19PM_ty6l6i.jpg')}
                                    alt={point.photo_url ? "Foto del material" : (point.type === 'colective_point' ? 'Contenedor Colectivo' : 'Reciclaje')}
                                    className="w-32 h-38 object-cover rounded-lg shadow-md border border-blue-200"
                                    style={{ background: '#f0fdf4', filter: 'drop-shadow(0 4px 12px rgba(34,197,94,0.25))' }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = point.type === 'colective_point'
                                        ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1756873463/iconescuela_loziof.png'
                                        : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1756952486/Generated_Image_September_03_2025_-_11_19PM_ty6l6i.jpg';
                                      target.className = target.className.replace('object-cover', 'object-contain');
                                    }}
                                  />
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
                              <div className="flex-1">
                                <div className="text-sm text-gray-700">
                                  <div className="mb-2"><strong>Autos estimados:</strong> {typeof (point as any).autos === 'number' ? (point as any).autos : (typeof (point as any).vehicles === 'number' ? (point as any).vehicles : 'No disponible')}</div>
                                  <div><strong>Barrio:</strong> {((point as any).district || (point as any).neighbourhood || (point as any).barrio || 'No disponible')}</div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm text-gray-500">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{point.schedule ? point.schedule : ''}</span>
                            </div>
                            {userLocation && (point as concentrationPoint & { calculatedDistance?: number }).calculatedDistance !== undefined && (
                              <div className="mt-2 flex items-center text-sm text-blue-600">
                                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">
                                  Distancia: {((point as concentrationPoint & { calculatedDistance?: number }).calculatedDistance)?.toFixed(1)} km de tu ubicación
                                </span>
                              </div>
                            )}
                            {typeof point.additional_info === 'string' && point.additional_info.trim() !== '' && (
                              <div className="mt-2 text-sm text-gray-600">
                                <strong>Información adicional:</strong> {point.additional_info}
                              </div>
                            )}
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => handleOpenPickupModal(point)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow"
                              >
                                Ver en mapa
                              </button>
                              <div className="flex items-center">
                                {typeof point.lng === 'number' && typeof point.lat === 'number' ? (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      const url = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    }}
                                    title="Abrir ruta de navegación en Google Maps"
                                    className="ml-2 flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-600 rounded hover:bg-blue-100 transition-colors shadow-sm text-blue-800 font-bold text-xs"
                                  >
                                    <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748481430/google-maps-icon_bur7my.png" alt="Google Maps" className="h-7 w-7 animate-bounce-map" />
                                    <span>Ruta Google Maps</span>
                                  </button>
                                ) : (
                                  <span className="ml-2 text-xs text-gray-400 italic">Ubicación no disponible</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <hr className="my-10 border-blue-300" />
                </div>
              )}
                  {view === 'dirigentes' && (
                    <div>
                      <h2 className="text-2xl font-bold text-green-700 mb-3">Dirigentes registrados</h2>
                      <div id="dirigente-recyclers-map" className="mb-4 w-full h-80 rounded-lg overflow-hidden border border-green-300 shadow">
                        <Map
                          markers={recyclers.filter(r => r.online && typeof r.lat === 'number' && typeof r.lng === 'number').map(r => ({
                            id: r.id,
                            lat: Number(r.lat),
                            lng: Number(r.lng),
                            title: r.profiles?.name || 'Reciclador',
                            avatar_url: r.profiles?.avatar_url,
                            role: r.role,
                            online: !!r.online,
                            iconsize: [36,36]
                          }))}
                          fitBounds={mapFitBounds}
                          centerToUser={mapCenterToUser}
                          showUserLocation={true}
                        />
                      </div>
                      {recyclers.filter(r => r.online).length === 0 ? (
                        <p className="text-gray-500">No hay Dirigentes en línea.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {recyclers.filter(r => r.online).map(rec => (
                            <div key={rec.id} className="border rounded-lg p-4 bg-white shadow-sm flex items-start gap-4">
                              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-green-200">
                                <img src={getAvatarUrl(rec.profiles?.avatar_url, rec.profiles?.name)} alt={rec.profiles?.name || 'Reciclador'} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0">
                                    <div className="font-bold text-green-700 truncate">{rec.profiles?.name || 'Dirigente'}</div>
                                    <div className="text-sm text-gray-500 flex flex-col mt-1">
                                      {rec.profiles?.email && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <Mail className="w-4 h-4 text-blue-500" />
                                          <span className="truncate">{rec.profiles.email}</span>
                                        </div>
                                      )}
                                      {rec.profiles?.phone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <Phone className="w-4 h-4 text-blue-500" />
                                          <span className="truncate">{rec.profiles.phone}</span>
                                        </div>
                                      )}
                                      {rec.profiles?.dni && (
                                        <div className="text-xs text-gray-500 mt-1">DNI: {rec.profiles.dni}</div>
                                      )}
                                      {!rec.profiles?.email && !rec.profiles?.phone && !rec.profiles?.dni && (
                                        <div className="text-sm text-gray-500">Sin contacto</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-500 ml-4">{typeof rec.rating_average === 'number' ? rec.rating_average.toFixed(1) : 'N/A'}</div>
                                </div>
                                {rec.bio && <div className="text-sm text-gray-600 mt-2">{rec.bio}</div>}
                                <div className="mt-3 flex gap-2">
                                  <button onClick={() => {
                                    if (rec.lat && rec.lng) {
                                      const sw: [number, number] = [Number(rec.lng), Number(rec.lat)];
                                      const ne: [number, number] = [Number(rec.lng), Number(rec.lat)];
                                      setMapFitBounds([sw, ne]);
                                      setTimeout(() => setMapFitBounds(null), 1500);
                                    }
                                  }} className="px-3 py-1 bg-green-600 text-white rounded">Ver en mapa</button>
                                  {rec.user_id && (/^[0-9a-fA-F-]{36}$/.test(rec.user_id)) ? (
                                    <Link to={`/chat/${rec.user_id}`} className="px-3 py-1 bg-blue-600 text-white rounded">Enviar mensaje</Link>
                                  ) : (
                                    <button className="px-3 py-1 bg-gray-200 text-gray-500 rounded" disabled>Chat no disponible</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              {/* Views 'reclamados', 'cancelados' and 'retirados' removed: claim logic is not used by Referentes */}
              {/* 'cancelados' view removed */}
              {/* 'retirados' view removed */}
            </div>
            {/* Modal de mapa */}
            {showMap && selectedPoint && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg w-full max-w-4xl mx-4">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium">{selectedPoint.address}</h3>
                    <button onClick={() => setShowMap(false)} className="text-gray-400 hover:text-gray-500">
                      <span className="sr-only">Cerrar</span>
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="h-96">
                    <Map
                      markers={[
                        {
                          id: selectedPoint.id,
                          lat: Number(selectedPoint.lat),
                          lng: Number(selectedPoint.lng),
                          title: selectedPoint.address,
                          avatar_url: selectedPoint.creator_avatar,
                          iconUrl: '/assets/logo%20cm%20pj.png'
                        }
                      ]}
                      showUserLocation={true}
                      showRoute={true}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* --- MODAL EDITAR PERFIL COMPLETO --- */}
           
            {showEditProfileModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 relative">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Editar Perfil</h3>
                    <button onClick={() => setShowEditProfileModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                  </div>
                  <EditProfileForm
                    onClose={() => setShowEditProfileModal(false)}
                    onProfileUpdated={async () => {
                      await fetchData();
                      setShowEditProfileModal(false);
                    }}
                  />
                </div>
              </div>
            )}
            {/* ratings modal removed */}
            {showChatModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Mensajes con Dirigentes</h3>
                    <button onClick={() => setShowChatModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                  </div>
                  {/* Lista de Dirigentes con historial de puntos o mensajes */}
                  {loadingChats ? (
                    <div className="p-4 text-center text-gray-500">Cargando chats...</div>
                  ) : (
                    <ChatList
                      chats={chatPreviews.map(chat => {
                        let lastMessage: { content: string; created_at: string } | undefined = undefined;
                        if (
                          chat.lastMessage &&
                          typeof chat.lastMessage === 'object' &&
                          'created_at' in chat.lastMessage
                        ) {
                          const content = (chat.lastMessage as { content?: string }).content ?? '';
                          const created_at = (chat.lastMessage as { created_at?: string }).created_at ?? '';
                          lastMessage = { content, created_at };
                        }
                        return {
                          userId: String(chat.user_id),
                          name: typeof chat.name === 'string' ? chat.name : '',
                          avatar_url: typeof chat.avatar_url === 'string' ? chat.avatar_url : undefined,
                          lastMessage,
                          unreadCount: typeof chat.unreadCount === 'number' ? chat.unreadCount : 0,
                        };
                      })}
                      onChatSelect={userId => {
                        setShowChatModal(false);
                        navigate(`/chat/${userId}`);
                      }}
                    />
                  )}
                  <div className="flex justify-end mt-4">
                    <button onClick={() => setShowChatModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Cerrar</button>
                                   </div>
                </div>
              </div>
            )}
            {/* Modal de rutas (estructura básica, puedes mejorar el contenido y lógica luego): */}
            {/* Modal de rutas eliminado para referentes */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardReferente;









