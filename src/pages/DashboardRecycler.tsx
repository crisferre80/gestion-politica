import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Phone, Mail, MapIcon, X, Clock } from 'lucide-react';
import { supabase, type CollectionPoint, cancelClaim, claimCollectionPoint, completeCollection } from '../lib/supabase';
import Map from '../components/Map';
import CountdownTimer from '../components/CountdownTimer';
import { useUser } from '../context/UserContext';
import NotificationBell from '../components/NotificationBell';
import HeaderRecycler from '../components/HeaderRecycler';
import { prepareImageForUpload, transformImage } from '../services/ImageTransformService';
import PhotoCapture from '../components/PhotoCapture';
import ChatList from '../components/ChatList';
import { getChatPreviews } from '../lib/chatUtils';
import { useNavigate } from 'react-router-dom';
import MyRecyclerRatingsModal from '../components/MyRecyclerRatingsModal';
import MapComponent from '../components/Map';
import { toast } from 'react-hot-toast';

// Importar funciones de prueba para debugging
import '../utils/testAvatarUpload.js';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getAvatarUrl } from '../utils/feedbackHelper';

const DashboardRecycler: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  // const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint] = useState<CollectionPoint | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showCancelClaimModal, setShowCancelClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<{ id: string; pointId: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  // Estado para el modal de programar recolección
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pointToClaim, setPointToClaim] = useState<CollectionPoint | null>(null);
  const [pickupDateTimeInput, setPickupDateTimeInput] = useState('');
  // Estado para el cambio de vista
  const [view, setViewState] = useState('disponibles');

  const [claimedPoints, setClaimedPoints] = useState<CollectionPoint[]>([]);
  const [availablePoints, setAvailablePoints] = useState<CollectionPoint[]>([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pointToComplete, setPointToComplete] = useState<CollectionPoint | null>(null);

  // Estados para filtro de distancia
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null); // en kilómetros
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // --- Chat state for ChatList modal ---
  interface ChatPreview {
    name: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unreadCount: any;
    avatar_url: string | undefined;
    lastMessage: unknown;
    id: string;
    user_id: string;
    recycler_id: string;
    last_message?: string;
    updated_at?: string;
    // Add other fields as needed based on your 'chats' table structure
  }
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false); // <-- Move this line up before useEffect

  // Fetch chat previews when chat modal is opened
  useEffect(() => {
    if (!showChatModal || !user) return;
    setLoadingChats(true);
    (async () => {
      try {
        // Buscar todos los mensajes donde el reciclador es sender o receiver
        const { data: messages, error } = await supabase
          .from('messages')
          .select('sender_id, receiver_id')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        if (error) throw error;
        // Extraer los user_id de los otros participantes
        const otherUserIds = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user.id)));
        // Obtener los previews usando la función utilitaria
        const previews = await getChatPreviews(user.id, otherUserIds);
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
      } finally {
        setLoadingChats(false);
      }
    })();
  }, [showChatModal, user]);

  // Fetch chat previews SIEMPRE que cambie el usuario (no solo al abrir el modal)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Buscar todos los mensajes donde el reciclador es sender o receiver
        const { data: messages, error } = await supabase
          .from('messages')
          .select('sender_id, receiver_id')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        if (error) throw error;
        // Extraer los user_id de los otros participantes
        const otherUserIds = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user.id)));
        // Obtener los previews usando la función utilitaria
        const previews = await getChatPreviews(user.id, otherUserIds);
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
    })();
  }, [user]);

  // NOTIFICACIONES DE MENSAJES NUEVOS

  // --- Notificaciones de eventos del residente ---
  const [eventNotifications, setEventNotifications] = useState<Array<{id: string, type: string, message: string, created_at: string}>>([]);

  // Define ResidentProfile type at the top-level so it's accessible everywhere in the component
  type ResidentProfile = {
    dni: string;
    user_id: string;
    name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  };

  // Función para calcular distancia usando fórmula de Haversine
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en kilómetros
  };

  // Función para obtener ubicación del usuario
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('La geolocalización no está soportada en este navegador');
      return;
    }

    setGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGettingLocation(false);
        setLocationError(null);
      },
      (error) => {
        setGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Permiso de ubicación denegado');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Información de ubicación no disponible');
            break;
          case error.TIMEOUT:
            setLocationError('Tiempo de espera agotado al obtener ubicación');
            break;
          default:
            setLocationError('Error desconocido al obtener ubicación');
            break;
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 300000 // 5 minutos
      }
    );
  };
  
    // Cargar puntos reclamados y disponibles
    const fetchData = useCallback(async () => {
      // Prevenir múltiples llamadas simultáneas usando referencia
      if (fetchDataRef.current) {
        console.log('fetchData ya está en ejecución, ignorando llamada duplicada');
        return;
      }
      
      fetchDataRef.current = true;
      
      try {
        setLoading(true);
        setError(null);
        
        if (!user) {
          setError('Usuario no autenticado');
          setLoading(false);
          return;
        }
        
        // Verificar que las tablas existen antes de realizar consultas
        const { checkTableExists } = await import('../lib/supabase');
        const pointsTableExists = await checkTableExists('collection_points');
        const claimsTableExists = await checkTableExists('collection_claims');
        
        if (!pointsTableExists) {
          setError('La tabla collection_points no existe en la base de datos. Verifica la conexión a Supabase y la configuración del esquema.');
          setLoading(false);
          return;
        }
        
        if (!claimsTableExists) {
          setError('La tabla collection_claims no existe en la base de datos. Verifica la conexión a Supabase y la configuración del esquema.');
          setLoading(false);
          return;
        }
        // Reclamos del reciclador (usando recycler_id correcto)
        const { data: claimsData, error: claimsError } = await supabase
          .from('collection_claims')
          .select('*')
          .eq('recycler_id', user.id) // Cambiado a recycler_id
          .order('created_at', { ascending: false }); // OK: solo columna raíz
        console.log('DEBUG: claimsData (recycler):', claimsData);
        if (claimsError) throw claimsError;
        // Para cada claim, obtener el punto y el perfil del residente
        let claimed: CollectionPoint[] = [];
        let profilesById: Record<string, ResidentProfile> = {}; // <-- Declarar solo una vez aquí
        if (claimsData && claimsData.length > 0) {
          // Obtener todos los point_user_id únicos
          const pointIds = claimsData.map(claim => claim.collection_point_id);
          const { data: pointsData, error: pointsError } = await supabase
            .from('collection_points')
            .select('*')
            .in('id', pointIds);
          console.log('DEBUG: pointsData (claimed):', pointsData);
          if (pointsError) throw pointsError;
          // Obtener todos los user_id de los residentes
          const residentUserIds = [...new Set(pointsData.map(p => p.user_id))];
          if (residentUserIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('user_id, name, email, phone, avatar_url, dni')
              .in('user_id', residentUserIds);
            if (profilesError) throw profilesError;
            profilesById = (profilesData || []).reduce((acc, profile) => {
              acc[profile.user_id] = profile;
              return acc;
            }, {} as Record<string, ResidentProfile>);
          }
          // Agrupar claims por collection_point_id y quedarnos con el más reciente (por created_at)
          type CollectionClaim = {
            id: string;
            collection_point_id: string;
            status: string;
            created_at: string;
            pickup_time?: string;
            cancelled_at?: string;
            cancellation_reason?: string;
            completed_at?: string;
          };
          const latestClaimsByPoint: Record<string, CollectionClaim> = {};
          claimsData.forEach(claim => {
            const existing = latestClaimsByPoint[claim.collection_point_id];
            if (!existing || new Date(claim.created_at) > new Date(existing.created_at)) {
              latestClaimsByPoint[claim.collection_point_id] = claim;
            }
          });
          claimed = Object.values(latestClaimsByPoint).map((claim: CollectionClaim) => {
            const point = pointsData.find(p => p.id === claim.collection_point_id) || {};
            const profile = profilesById[point.user_id] || {};
            return {
              ...point,
              claim_id: claim.id,
              claim_status: claim.status, // status real del claim
              status: claim.status, // para compatibilidad
              creator_name: profile.name || 'Usuario Anónimo',
              creator_email: profile.email,
              creator_phone: profile.phone,
              creator_avatar: profile.avatar_url,
              creator_dni: profile.dni,
              pickup_time: claim.pickup_time,
              profiles: profile,
              cancelled_at: claim.cancelled_at,
              cancellation_reason: claim.cancellation_reason,
              completed_at: claim.completed_at,
            };
          });
        }
        console.log('DEBUG: claimed array:', claimed);
      // Puntos disponibles (igual que antes)
      const { data: availableData, error: availableError } = await supabase
        .from('collection_points')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });
     
      if (availableError) throw availableError;
      let availablePointsRaw = availableData || [];
      // Debug: mostrar cuántos puntos trae la consulta inicial
      console.log('DEBUG: Puntos disponibles iniciales:', availablePointsRaw.length, availablePointsRaw.map(p => p.id));
      // Filtrar puntos que ya tienen un claim activo (solo 'claimed' o 'completed', NO 'cancelled')
      // Los puntos cancelados deben estar disponibles nuevamente
      const availableIds = availablePointsRaw.map(p => p.id);
      // Buscar claims activos para esos puntos (excluyendo cancelados)
      let claimedPointIds: string[] = [];
      if (availableIds.length > 0) {
        const { data: claims, error: claimsError2 } = await supabase
          .from('collection_claims')
          .select('collection_point_id, status, recycler_id, created_at')
          .in('collection_point_id', availableIds)
          .order('created_at', { ascending: false }); // Ordenar por fecha para facilitar el procesamiento
        
        console.log('DEBUG: claims for available points:', claims);
        console.log('DEBUG: Punto específico c1edea08-105a-4cdd-97d2-dd65bd9ffcaa claims:', 
          claims?.filter(c => c.collection_point_id === 'c1edea08-105a-4cdd-97d2-dd65bd9ffcaa'));
        
        if (!claimsError2 && claims) {
          // Agrupar claims por collection_point_id y obtener el más reciente
          type ClaimForFiltering = {
            collection_point_id: string;
            status: string;
            recycler_id: string;
            created_at: string;
          };
          
          const latestClaimsByPoint: Record<string, ClaimForFiltering> = {};
          claims.forEach(claim => {
            const existing = latestClaimsByPoint[claim.collection_point_id];
            const claimDate = new Date(claim.created_at).getTime();
            const existingDate = existing ? new Date(existing.created_at).getTime() : 0;
            
            if (!existing || claimDate > existingDate) {
              latestClaimsByPoint[claim.collection_point_id] = claim;
            }
          });
          
          console.log('DEBUG: Latest claims by point:', latestClaimsByPoint);
          console.log('DEBUG: Latest claim for punto c1edea08-105a-4cdd-97d2-dd65bd9ffcaa:', 
            latestClaimsByPoint['c1edea08-105a-4cdd-97d2-dd65bd9ffcaa']);
          
          // Solo excluir puntos cuyo claim más reciente esté 'claimed' o 'completed'
          claimedPointIds = Object.values(latestClaimsByPoint)
            .filter((claim: ClaimForFiltering) => {
              const shouldExclude = claim.status === 'claimed' || claim.status === 'completed';
              console.log(`DEBUG: Punto ${claim.collection_point_id} - status: ${claim.status} - será excluido: ${shouldExclude}`);
              return shouldExclude;
            })
            .map((claim: ClaimForFiltering) => claim.collection_point_id);
        }
      }
      // Debug: mostrar los IDs de puntos excluidos por claims activos
      console.log('DEBUG: claimedPointIds (excluidos por claims activos):', claimedPointIds);
      // Excluir los puntos ya reclamados (solo con claims activos)
      availablePointsRaw = availablePointsRaw.filter(p => !claimedPointIds.includes(p.id));
      // Debug: mostrar cuántos puntos quedan tras el filtro
      console.log('DEBUG: Puntos disponibles tras filtro de claims activos:', availablePointsRaw.length, availablePointsRaw.map(p => p.id));
      // Buscar claims cancelados recientes por este reciclador específico
      // Un reciclador no puede reclamar nuevamente un punto que él mismo canceló recientemente (penalización de 3 horas)
      let penalizedPointIds: string[] = [];
      if (claimsData && claimsData.length > 0) {
        const now = new Date();
        penalizedPointIds = claimsData
          .filter(c => c.status === 'cancelled' && c.cancelled_at && c.recycler_id === user.id) // Solo cancelaciones de este reciclador
          .filter(c => {
            const cancelledAt = new Date(c.cancelled_at);
            return (now.getTime() - cancelledAt.getTime()) < 3 * 60 * 60 * 1000; // 3 horas
          })
          .map(c => c.collection_point_id);
      }
      console.log('DEBUG: penalizedPointIds para este reciclador:', penalizedPointIds);
      // Excluir los puntos penalizados para este reciclador específico
      const trulyAvailablePointsRaw = availablePointsRaw.filter(p => !penalizedPointIds.includes(p.id));
      // Debug: mostrar cuántos puntos quedan tras el filtro de penalización
      console.log('DEBUG: Puntos disponibles tras filtro de penalización:', trulyAvailablePointsRaw.length, trulyAvailablePointsRaw.map(p => p.id));
      
      // NUEVO FILTRO: Excluir puntos de residentes asociados a puntos colectivos
      // Primero obtener todos los puntos colectivos existentes
      const { data: collectivePoints, error: collectiveError } = await supabase
        .from('collection_points')
        .select('address, type')
        .eq('type', 'colective_point');
      
      let filteredAvailablePoints = trulyAvailablePointsRaw;
      
      if (!collectiveError && collectivePoints && collectivePoints.length > 0) {
        // Obtener las direcciones de todos los puntos colectivos
        const collectiveAddresses = collectivePoints.map(cp => cp.address);
        console.log('DEBUG: Direcciones de puntos colectivos:', collectiveAddresses);
        
        // Filtrar puntos que NO son de tipo colectivo pero están en la misma dirección que un punto colectivo
        filteredAvailablePoints = trulyAvailablePointsRaw.filter(p => {
          // Mantener los puntos colectivos
          if (p.type === 'colective_point') {
            return true;
          }
          // Excluir puntos individuales que están en la misma dirección que un punto colectivo
          const isAtCollectiveAddress = collectiveAddresses.includes(p.address);
          if (isAtCollectiveAddress) {
            console.log('DEBUG: Excluyendo punto individual en dirección colectiva:', p.id, p.address);
          }
          return !isAtCollectiveAddress;
        });
        
        console.log('DEBUG: Puntos tras filtro de asociación a colectivos:', filteredAvailablePoints.length, filteredAvailablePoints.map(p => p.id));
      }
      
      const userIds = [...new Set(filteredAvailablePoints.map(p => p.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, email, phone, avatar_url, dni')
          .in('user_id', userIds);
        if (profilesError) throw profilesError;
        profilesById = {
          ...profilesById,
          ...((profilesData || []).reduce((acc, profile) => {
            acc[profile.user_id] = profile;
            return acc;
          }, {} as Record<string, ResidentProfile>))
        };
      }
      setClaimedPoints(claimed);
      setAvailablePoints(filteredAvailablePoints.map(point => {
        const profile = profilesById[point.user_id] || {};
        // Asegura que point.materials sea siempre un array
        let materials: string[] = [];
        if (Array.isArray(point.materials)) {
          materials = point.materials;
        } else if (typeof point.materials === 'string' && point.materials.length > 0) {
          try {
            // Intenta parsear como JSON si es string tipo '["Papel","Plástico"]'
            const parsed = JSON.parse(point.materials);
            if (Array.isArray(parsed)) materials = parsed;
            else materials = [point.materials];
          } catch {
            materials = [point.materials];
          }
        }
        return {
          ...point,
          creator_name: profile?.name || 'Usuario Anónimo',
          creator_email: profile?.email,
          creator_phone: profile?.phone,
          creator_avatar: profile?.avatar_url,
          creator_dni: profile?.dni,
          profiles: profile,
          materials,
        };
      }));
    } catch (err) {
      console.error('Error en fetchData:', err);
      
      // Manejo más específico de errores
      let errorMessage = 'Error al cargar los datos';
      
      if (err && typeof err === 'object') {
        if ('code' in err) {
          const errorCode = (err as { code: string }).code;
          switch (errorCode) {
            case '42P01':
              errorMessage = 'Tabla no encontrada en la base de datos. Contacta al administrador.';
              break;
            case 'PGRST116':
              errorMessage = 'Error de conexión con la base de datos. Verifica tu conexión a internet.';
              break;
            case '42703':
              errorMessage = 'Error en la estructura de la base de datos. Contacta al administrador.';
              break;
            default:
              if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
                errorMessage = (err as { message: string }).message;
              }
          }
        } else if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
          errorMessage = (err as { message: string }).message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      // Si es un error crítico, no mostrar detalles técnicos al usuario
      if (errorMessage.includes('JSON') || errorMessage.includes('undefined')) {
        errorMessage = 'Error interno de la aplicación. Por favor, recarga la página.';
      }
      
      setError(errorMessage);
      
      // Log detallado para desarrollo
      console.error('Detalles completos del error:', {
        error: err,
        timestamp: new Date().toISOString(),
        user: user?.id
      });
    } finally {
      setLoading(false);
      fetchDataRef.current = false; // Resetear la referencia al finalizar
    }
  }, [user]);

  // Inicialización de Supabase y carga de datos
  useEffect(() => {
    if (!user) return;
    
    const init = async () => {
      try {
        // Verificar la configuración de Supabase
        const { initializeSupabase } = await import('../lib/supabase');
        const initialized = await initializeSupabase();
        
        if (!initialized) {
          console.error('No se pudo inicializar correctamente la conexión con Supabase');
          setError('Error de conexión con la base de datos. Por favor, contacta al administrador.');
          return;
        }
        
        // Cargar los datos
        await fetchData();
      } catch (error) {
        console.error('Error en la inicialización:', error);
        setError('Error al inicializar la aplicación. Por favor, recarga la página.');
      }
    };
    
    init();
  }, [user, fetchData]);

  // Abrir modal para programar recolección
  const handleOpenPickupModal = (point: CollectionPoint) => {
    setPointToClaim(point);
    setPickupDateTimeInput(''); // Resetear input
    setShowPickupModal(true);
    setError(null); // Limpiar errores previos
  };

  // Estado para mensaje de éxito al reclamar
  const [claimSuccess, setClaimSuccess] = useState(false);
  
  // Estado para controlar operaciones en curso y evitar conflictos
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const fetchDataRef = useRef(false);

  // Confirmar reclamo con hora de recolección
  const handleConfirmClaim = async () => {
    // Prevenir múltiples operaciones simultáneas
    if (isProcessingClaim) {
      console.log('Ya hay una operación de reclamo en curso');
      return;
    }

    if (!user) {
      setError('Usuario no autenticado');
      return;
    }
    if (!pointToClaim) {
      setError('No se ha seleccionado un punto para reclamar.');
      return;
    }
    if (!pickupDateTimeInput) {
      setError('Por favor, selecciona una fecha y hora para la recolección.');
      return;
    }
    
    // Validar que los IDs sean UUIDs válidos
    const isValidUuid = (id: string | null | undefined) => !!id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
    if (!isValidUuid(pointToClaim.id) || !isValidUuid(user.id) || !isValidUuid(pointToClaim.user_id)) {
      setError('Error: Uno o más IDs no son válidos');
      return;
    }
    
    // Marcar operación en curso
    setIsProcessingClaim(true);
    setError(null);
    setLoading(true);
    
    // Guardar referencias antes de limpiar el estado
    const pointBeingClaimed = { ...pointToClaim };
    const pickupTime = new Date(pickupDateTimeInput).toISOString();
    
    // Cerrar modal inmediatamente para mejor UX
    setShowPickupModal(false);
    setPointToClaim(null);
    setPickupDateTimeInput('');
    setClaimSuccess(false);
    
    try {
      console.log('Iniciando reclamación de punto:', {
        point_id: pointBeingClaimed.id, 
        recycler_id: user.id,
        pickup_time: pickupTime,
        user_id: pointBeingClaimed.user_id
      });
      
      await claimCollectionPoint(
        pointBeingClaimed.id, // collection_point_id (UUID string)
        user.id, // recycler_user_id (UUID string)
        pickupTime,
        pointBeingClaimed.user_id // user_id del residente dueño del punto (UUID string)
      );
      
      console.log('Punto reclamado exitosamente');
      
      // Mostrar mensaje de éxito
      setClaimSuccess(true);
      toast.success('Punto reclamado exitosamente');
      
      // Cambiar a vista de reclamados
      setViewState('reclamados');
      
      // Recargar datos después de un breve delay para asegurar que la BD esté actualizada
      setTimeout(async () => {
        try {
          await fetchData();
        } catch (fetchErr) {
          console.error('Error al recargar datos después del reclamo:', fetchErr);
          setError('El punto fue reclamado pero hubo un error al actualizar la vista. Recarga la página.');
        }
      }, 1000);
      
      setTimeout(() => setClaimSuccess(false), 3000);
    } catch (err: unknown) {
      console.error('Error al reclamar punto:', err);
      console.error('Detalles completos del error:', {
        error: err,
        point_id: pointBeingClaimed.id,
        recycler_id: user.id,
        user_id: pointBeingClaimed.user_id,
        timestamp: new Date().toISOString()
      });
      
      let message = 'No se pudo reclamar el punto de recolección.';
      
      if (err && typeof err === 'object') {
        if ('code' in err && err.code === '42P01') {
          message = 'Error en la base de datos: tabla no encontrada. Contacta al administrador.';
        } else if ('code' in err && err.code === '23505') {
          message = 'Este punto ya ha sido reclamado por otro reciclador mientras procesabas tu solicitud.';
        } else if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
          const errorMessage = (err as { message: string }).message;
          
          if (errorMessage.includes('already claimed') || errorMessage.includes('ya reclamado')) {
            message = 'Este punto ya ha sido reclamado por otro reciclador.';
          } else if (errorMessage.includes('not found') || errorMessage.includes('no encontrado')) {
            message = 'El punto de recolección ya no está disponible o fue eliminado.';
          } else if (errorMessage.includes('violates foreign key')) {
            message = 'Error de referencia en la base de datos. El punto puede haber sido eliminado.';
          } else if (errorMessage.includes('duplicate key') || errorMessage.includes('clave duplicada')) {
            message = 'Ya has reclamado este punto anteriormente o está siendo procesado por otro reciclador.';
          } else if (errorMessage.includes('claim cancelado que impide')) {
            message = 'Error temporal con un reclamo cancelado anterior. Reintenta en unos segundos.';
          } else {
            message = `Error: ${errorMessage}`;
          }
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError(message);
      toast.error(message);
      
      // Recargar datos para sincronizar el estado actual
      try {
        await fetchData();
      } catch (fetchErr) {
        console.error('Error al recargar datos después del error:', fetchErr);
        setError(prev => prev + '\n\nNo se pudieron recargar los datos. Recarga la página.');
      }
    } finally {
      setLoading(false);
      setIsProcessingClaim(false);
    }
  };

  // Cancelar reclamo
  const handleCancelClaim = async () => {
    if (!selectedClaim || !user) return;
    
    // Validar que los IDs sean UUIDs válidos y no vacíos
    const isValidUuid = (id: string | null | undefined) => !!id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
    if (!isValidUuid(selectedClaim.id) || !isValidUuid(selectedClaim.pointId)) {
      setError('Error: ID de reclamo o punto inválido.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await cancelClaim(selectedClaim.id, selectedClaim.pointId, cancellationReason);
      
      // Cerrar modal y limpiar estado
      setShowCancelClaimModal(false);
      setSelectedClaim(null);
      setCancellationReason('');
      
      toast.success('Reclamo cancelado exitosamente');
      
      // Recargar datos con un pequeño delay
      setTimeout(async () => {
        try {
          await fetchData();
        } catch (fetchErr) {
          console.error('Error al recargar datos después de cancelar:', fetchErr);
          setError('El reclamo fue cancelado pero hubo un error al actualizar la vista. Recarga la página.');
        }
      }, 500);
      
    } catch (err: unknown) {
      console.error('Error al cancelar reclamo:', err);
      
      let message = 'No se pudo cancelar la reclamación.';
      
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
        const errorMessage = (err as { message: string }).message;
        
        if (errorMessage.includes('not found')) {
          message = 'La reclamación ya no existe o fue modificada por otro usuario.';
        } else if (errorMessage.includes('already cancelled')) {
          message = 'Esta reclamación ya ha sido cancelada.';
        } else {
          message = errorMessage;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Marcar punto como retirado
  const handleCompleteCollection = async () => {
    if (!pointToComplete || !pointToComplete.claim_id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[DEBUG handleCompleteCollection] claim_id:', pointToComplete.claim_id, 'point_id:', pointToComplete.id);
      
      await completeCollection(pointToComplete.claim_id, pointToComplete.id);
      
      // Cerrar modal
      setShowCompleteModal(false);
      
      toast.success('Punto marcado como retirado exitosamente');
      
      // Recargar datos con delay para asegurar consistencia
      setTimeout(async () => {
        try {
          await fetchData();
        } catch (fetchErr) {
          console.error('Error al recargar datos después de completar:', fetchErr);
          setError('El punto fue marcado como retirado pero hubo un error al actualizar la vista. Recarga la página.');
        }
      }, 500);
      
    } catch (err: unknown) {
      console.error('[DEBUG handleCompleteCollection] error:', err);
      
      let message = 'No se pudo marcar el punto como retirado.';
      
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
        const errorMessage = (err as { message: string }).message;
        
        if (errorMessage.includes('not found')) {
          message = 'La reclamación ya no existe o fue modificada.';
        } else if (errorMessage.includes('already completed')) {
          message = 'Este punto ya ha sido marcado como retirado.';
        } else {
          message = errorMessage;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // --- PRESENCIA EN TIEMPO REAL ---
  useEffect(() => {
    if (!user?.id) return;
    // Marcar online al entrar
    supabase.from('profiles').update({ online: true }).eq('user_id', user.id);
    // Timer de inactividad: 60 minutos
    let inactivityTimeout: NodeJS.Timeout | null = null;
    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(async () => {
        await supabase.from('profiles').update({ online: false }).eq('user_id', user.id);
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
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ online: false })
          .eq('user_id', user.id);
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
            await supabase
              .from('profiles')
              .update({ lat, lng })
              .eq('user_id', user.id);
          }
        );
      }
    };
    updateLocation(); // Actualiza al cargar
    const intervalId = setInterval(updateLocation, 30000); // Cada 30 segundos
    return () => clearInterval(intervalId);
  }, [user]);

  // Escuchar eventos relevantes del residente (puntos reclamados, calificaciones, etc.)
  useEffect(() => {
    if (!user?.id) return;
    // Suscribirse a eventos de collection_claims y recycler_ratings relacionados con el usuario
    const channel = supabase.channel('resident-events')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_claims',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEventNotifications(prev => [
            { id: payload.new.id, type: 'claim', message: 'Un reciclador ha reclamado tu punto de recolección.', created_at: payload.new.created_at },
            ...prev
          ]);
        }
        if (payload.eventType === 'UPDATE' && payload.new.status === 'completed') {
          setEventNotifications(prev => [
            { id: payload.new.id, type: 'completed', message: 'Un reciclador ha marcado tu punto como retirado.', created_at: payload.new.updated_at },
            ...prev
          ]);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'recycler_ratings',
        filter: `resident_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEventNotifications(prev => [
            { id: payload.new.id, type: 'rating', message: 'Has calificado a un reciclador.', created_at: payload.new.created_at },
            ...prev
          ]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Suscripción en tiempo real a collection_points y collection_claims para actualización instantánea
  useEffect(() => {
    if (!user?.id) return;
    
    // Suscripción a collection_points con debounce para evitar actualizaciones excesivas
    const channelPoints = supabase.channel('recycler-collection-points')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_points',
      }, () => {
        // Solo actualizar si no hay operaciones en curso
        if (!isProcessingClaim) {
          // Usar un pequeño delay para evitar actualizaciones demasiado frecuentes
          setTimeout(() => {
            if (!isProcessingClaim) {
              fetchData();
            }
          }, 500);
        }
      });
      
    // Suscripción a collection_claims con mayor cuidado
    const channelClaims = supabase.channel('recycler-collection-claims')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_claims',
        filter: `recycler_id=eq.${user.id}`,
      }, (payload) => {
        console.log('Cambio en claims detectado:', payload);
        
        // Solo actualizar si no hay operaciones en curso y no es un INSERT reciente
        if (!isProcessingClaim) {
          // Para eventos UPDATE o DELETE, actualizar inmediatamente
          // Para eventos INSERT, esperar un poco más para evitar conflictos
          const delay = payload.eventType === 'INSERT' ? 1500 : 500;
          
          setTimeout(() => {
            if (!isProcessingClaim) {
              fetchData();
            }
          }, delay);
        }
      });
      
    // Activar ambos canales
    channelPoints.subscribe();
    channelClaims.subscribe();
    
    return () => {
      supabase.removeChannel(channelPoints);
      supabase.removeChannel(channelClaims);
    };
  }, [user, fetchData, isProcessingClaim]);

  // Suscripción en tiempo real a mensajes para actualizar badge de mensajes no leídos
  useEffect(() => {
    if (!user?.id) return;
    // Suscribirse a cambios donde el usuario es sender
    const channelSender = supabase.channel('recycler-messages-badge-sender')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${user.id}`,
      }, async () => {
        try {
          const { data: messages, error } = await supabase
            .from('messages')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
          if (error) throw error;
          const otherUserIds = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user.id)));
          const previews = await getChatPreviews(user.id, otherUserIds);
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
        filter: `receiver_id=eq.${user.id}`,
      }, async () => {
        try {
          const { data: messages, error } = await supabase
            .from('messages')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
          if (error) throw error;
          const otherUserIds = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user.id)));
          const previews = await getChatPreviews(user.id, otherUserIds);
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
  const [showPointsStatsModal, setShowPointsStatsModal] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.profileId) {
      setProfileId(user.profileId);
    } else if (user && user.id) {
      // Buscar el id interno del perfil si no está en el contexto
      (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data && data.id) setProfileId(data.id);
      })();
    }
  }, [user]);

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

    // Función local para subir avatar (igual que en DashboardResident)
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
        const filePath = `avatars/${fileName}`;
        
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
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('user_id', globalUser.id);
          
          if (updateError) throw updateError;
          console.log('Perfil actualizado en BD:', updateData);
        }
        
        // Obtener el perfil actualizado y actualizar el contexto global
        const { data: updatedProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', globalUser.id)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (updatedProfile) {
          // Asegurar que se mantenga el tipo de usuario como 'recycler'
          const updatedUser = { 
            ...globalUser, 
            ...updatedProfile,
            type: 'recycler', // Mantener el tipo como reciclador
            role: 'recycler'  // Asegurar el rol correcto
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
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-green-400 bg-white">
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
          
          {/* PhotoCapture igual que en DashboardResident */}
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
                // Actualizar el perfil en Supabase
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ avatar_url: url })
                  .eq('user_id', globalUser.id);
                if (updateError) {
                  setError('Error al actualizar el perfil con la nueva foto.');
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
        {success && <div className="text-green-600 text-sm">¡Perfil actualizado!</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow">
            {loading ? 'Actualizando...' : 'Actualizar perfil'}
          </button>
        </div>
      </form>
    );
  };

  // --- Estado para rutas de recolección ---
  const [showRouteModal, setShowRouteModal] = useState(false);
  interface Route {
    point_ids: never[];
    id: string;
    user_id: string;
    name: string;
    points: Array<{ lat: number; lng: number }>;
    created_at?: string;
    // Add other fields if needed
  }
  const [routes, setRoutes] = useState<Route[]>([]); // Rutas guardadas
  const [activeRoute, setActiveRoute] = useState<Route | null>(null); // Ruta seleccionada para mostrar en el mapa
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [selectedRoutePoints, setSelectedRoutePoints] = useState<string[]>([]); // IDs de puntos seleccionados para nueva ruta
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSuccess, setRouteSuccess] = useState<string | null>(null);

  // --- Estado para edición de rutas ---
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [editSelectedPoints, setEditSelectedPoints] = useState<string[]>([]);
  const [editRouteLoading, setEditRouteLoading] = useState(false);
  const [editRouteError, setEditRouteError] = useState<string | null>(null);
  const [editRouteSuccess, setEditRouteSuccess] = useState<string | null>(null);

  // Cargar rutas guardadas al abrir el modal
  useEffect(() => {
    if (!showRouteModal || !user) return;
    setRouteLoading(true);
    setRouteError(null);
    supabase
      .from('recycler_routes')
      .select('*')
      .eq('recycler_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          setRouteError('Error al cargar rutas: ' + (error.message || ''));
        }
        // Ordenar en frontend si es necesario
        const sorted = (data || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRoutes(sorted);
        setRouteLoading(false);
      });
  }, [showRouteModal, user]);

  // Guardar nueva ruta
  const handleSaveRoute = async () => {
    if (!user) return;
    if (!newRouteName.trim() || selectedRoutePoints.length < 2) {
      setRouteError('Selecciona al menos 2 puntos y un nombre para la ruta');
      return;
    }
    setRouteLoading(true);
    setRouteError(null);
    setRouteSuccess(null);
    // Obtener los puntos seleccionados en orden
    const points = claimedPoints.filter(p => selectedRoutePoints.includes(p.id));
    // Mantener el orden de selección
    const orderedPoints = selectedRoutePoints.map(id => points.find(p => p.id === id)).filter(Boolean);
    // Asegura que todos los IDs sean strings UUID válidos
    const routePointIds = orderedPoints.map(p => String(p!.id));
    const { error } = await supabase.from('recycler_routes').insert([
      {
        recycler_id: user.id, // Cambiado de user_id a recycler_id
        name: newRouteName.trim(),
        point_ids: routePointIds, // Siempre un array de strings UUID
      }
    ]);
    if (error) {
      setRouteError('Error al guardar la ruta: ' + (error.message || ''));
    } else {
      setRouteSuccess('Ruta guardada correctamente');
      setCreatingRoute(false);
      setNewRouteName('');
      setSelectedRoutePoints([]);
      // Refrescar rutas
      const { data, error: fetchError } = await supabase.from('recycler_routes').select('*').eq('recycler_id', user.id);
      if (fetchError) {
        setRouteError('Error al recargar rutas: ' + (fetchError.message || ''));
      } else {
        const sorted = (data || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRoutes(sorted);
      }
    }
    setRouteLoading(false);
  };

  // Eliminar ruta
  const handleDeleteRoute = async (routeId: string) => {
    if (!user) return;
    setRouteLoading(true);
    setRouteError(null);
    await supabase.from('recycler_routes').delete().eq('id', routeId);
    setRoutes(routes.filter(r => r.id !== routeId));
    if (activeRoute && activeRoute.id === routeId) setActiveRoute(null);
    setRouteLoading(false);
  };

  // Selección de puntos para nueva ruta
  const toggleSelectPoint = (pointId: string) => {
    setSelectedRoutePoints(prev => prev.includes(pointId) ? prev.filter(id => id !== pointId) : [...prev, pointId]);
  };

  // --- EDICIÓN DE RUTAS ---
  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setEditRouteName(route.name);
    setEditSelectedPoints(Array.isArray(route.point_ids) ? [...route.point_ids] : []);
    setEditRouteError(null);
    setEditRouteSuccess(null);
  };

  const handleSaveEditRoute = async () => {
    if (!editingRoute || !user) return;
    if (!editRouteName.trim() || editSelectedPoints.length < 2) {
      setEditRouteError('Selecciona al menos 2 puntos y un nombre para la ruta');
      return;
    }
    setEditRouteLoading(true);
    setEditRouteError(null);
    setEditRouteSuccess(null);
    try {
      // Asegura que todos los IDs sean strings UUID válidos
      const safeEditPointIds = editSelectedPoints.map(id => String(id));
      // Actualizar en Supabase
      const { error } = await supabase.from('recycler_routes')
        .update({
          name: editRouteName.trim(),
          point_ids: safeEditPointIds, // Siempre un array de strings UUID
        })
        .eq('id', editingRoute.id);
      if (error) {
        setEditRouteError('Error al actualizar la ruta');
      } else {
        setEditRouteSuccess('Ruta actualizada correctamente');
        // Refrescar rutas
        const { data } = await supabase.from('recycler_routes').select('*').eq('recycler_id', user.id);
        const sorted = (data || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRoutes(sorted);
        setEditingRoute(null);
        setEditRouteName('');
        setEditSelectedPoints([]);
      }
    } finally {
      setEditRouteLoading(false);
    }
  };

  const handleCancelEditRoute = () => {
    setEditingRoute(null);
    setEditRouteName('');
    setEditSelectedPoints([]);
    setEditRouteError(null);
    setEditRouteSuccess(null);
  };

  const toggleEditSelectPoint = (pointId: string) => {
    setEditSelectedPoints(prev => prev.includes(pointId) ? prev.filter(id => id !== pointId) : [...prev, pointId]);
  };

  const [showAllPointsMap, setShowAllPointsMap] = useState(false);

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

  // Exclude points that are already claimed by this recycler (by id)
  const claimedIds = new Set(claimedPoints.map(p => p.id));
  let trulyAvailablePoints = availablePoints.filter(p => !claimedIds.has(p.id));
  
  // Aplicar filtro de distancia si está habilitado
  if (userLocation && maxDistance) {
    trulyAvailablePoints = trulyAvailablePoints.filter(point => {
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
      (point as CollectionPoint & { calculatedDistance?: number }).calculatedDistance = distance;
      
      return distance <= maxDistance;
    });
  } else {
    // Si no hay filtro de distancia, calcular distancias de todos modos para mostrarlas si hay ubicación
    if (userLocation) {
      trulyAvailablePoints = trulyAvailablePoints.map(point => {
        if (typeof point.lat === 'number' && typeof point.lng === 'number') {
          const distance = calculateDistance(
            userLocation.lat, 
            userLocation.lng, 
            point.lat, 
            point.lng
          );
          (point as CollectionPoint & { calculatedDistance?: number }).calculatedDistance = distance;
        }
        return point;
      });
    }
  }
  
  // Ordenar por distancia si hay ubicación del usuario
  if (userLocation) {
    trulyAvailablePoints.sort((a, b) => {
      const distanceA = (a as CollectionPoint & { calculatedDistance?: number }).calculatedDistance;
      const distanceB = (b as CollectionPoint & { calculatedDistance?: number }).calculatedDistance;
      
      // Los puntos sin coordenadas van al final
      if (distanceA === undefined && distanceB === undefined) return 0;
      if (distanceA === undefined) return 1;
      if (distanceB === undefined) return -1;
      
      return distanceA - distanceB;
    });
  }
  
  console.log('DEBUG: claimedPoints:', claimedPoints);
  console.log('DEBUG: availablePoints:', availablePoints);
  console.log('DEBUG: trulyAvailablePoints (after distance filter):', trulyAvailablePoints);

  // Handler para cambio de vista que limpia el residente enfocado
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

        {/* Mensaje de éxito al reclamar */}
        {claimSuccess && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  ¡Punto reclamado exitosamente! Se ha añadido a tu lista de puntos reclamados.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- MAPA DE PUNTOS DE RECOLECCIÓN --- */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414a4 4 0 10-1.414 1.414l4.243 4.243a1 1 0 001.414-1.414z" /></svg>
              Mapa de Puntos de Recolección
            </h2>
            <button
              className="px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 font-semibold text-sm"
              onClick={() => setShowAllPointsMap((v) => !v)}
            >
              {showAllPointsMap ? 'Ocultar mapa' : 'Ver mapa'}
            </button>
          </div>
          {showAllPointsMap && (
            <div className="w-full h-96 rounded-lg overflow-hidden border border-green-300 shadow mb-2 animate-fade-in">
              <Map
                markers={[
                  ...availablePoints.map(p => ({
                    id: p.id,
                    lat: Number(p.lat),
                    lng: Number(p.lng),
                    title: p.address,
                    avatar_url: p.creator_avatar || undefined,
                    iconUrl: 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png',
                    status: 'disponible',
                    iconsize: [96, 96]
                  })),
                  ...claimedPoints.map(p => ({
                    id: p.id,
                    lat: Number(p.lat),
                    lng: Number(p.lng),
                    title: p.address,
                    avatar_url: p.creator_avatar || undefined,
                    iconUrl: 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750101287/Punto_de_Recoleccion_reclamado_Marcador_m3c4rd.png',
                    status: p.claim_status,
                    iconsize: [96, 96]
                    // iconsize: [60, 60] // Uncomment and use this if your Map component supports iconSize as an array
                  })),
                ]}
                showUserLocation={true}
                showAdminZonesButton={true}
                hideDrawControls={true} // Oculta controles de dibujo
              />
            </div>
          )}
        </div>
        {/* --- FIN MAPA --- */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-green-800">Panel del Reciclador</h1>
          <div className="flex items-center gap-4">
            <span className="inline-block px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-semibold tracking-wide">Reciclador</span>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header profesional del reciclador */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-8 py-8 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100">
            <div className="flex-shrink-0">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-green-400 bg-white shadow">
                <img src={getAvatarUrl(user?.avatar_url, user?.name)} alt="Foto de perfil" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-green-800 mb-1">{user?.name || 'Reciclador'}</h1>
                  {user?.online ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold ml-2 animate-pulse">
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
                  <Mail className="h-4 w-4 text-green-500" />
                  <span>{user?.email}</span>
                </div>
                {user?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-500" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user?.address && (
                  <div className="flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-green-500" />
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
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow"
                    onClick={() => navigate('/estadisticas')}
                  >
                    Ver Estadísticas
                  </button>
                  <button
                    className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold shadow"
                    onClick={() => setShowPointsStatsModal(true)}
                  >
                    Mis calificaciones
                  </button>
                  <button
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 font-semibold shadow flex items-center gap-2 relative"
                    onClick={() => setShowChatModal(true)}
                    // disabled={!canChatWithResident}
                    // title={canChatWithResident ? "Abrir chat con residente" : "Solo disponible si el residente habilita el chat"}
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
                    className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 font-semibold shadow flex items-center gap-2"
                    onClick={() => setShowRouteModal(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v4a1 1 0 001 1h3m10 0h3a1 1 0 001-1V7m-1-4H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z" /></svg>
                    Mis Rutas
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {claimSuccess && (
              <div className="flex items-center justify-center mb-6 animate-bounce-in">
                <div className="bg-green-100 border border-green-400 text-green-800 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
                  <svg className="w-7 h-7 text-green-600 animate-ping" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="font-semibold text-lg">¡Punto reclamado exitosamente!</span>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {/* Mostrar notificaciones de eventos del residente */}
            {eventNotifications.length > 0 && (
              <div className="mb-4 w-full max-w-2xl bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded relative" role="alert">
                <h4 className="font-bold mb-2">Notificaciones recientes</h4>
                <ul className="space-y-1">
                  {eventNotifications.slice(0, 5).map(ev => (
                    <li key={ev.id} className="text-sm flex items-center gap-2">
                      <span className="font-semibold">[{new Date(ev.created_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}]</span>
                      <span>{ev.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Botones para selección de vista */}
            <div className="mb-6 flex flex-wrap gap-2 justify-center md:justify-end">
              <button
                onClick={() => handleSetView('disponibles')}
                className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 min-w-[140px] text-sm
                  ${view === 'disponibles'
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'}
                `}
              >
                Disponibles
                {trulyAvailablePoints.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-800 text-white rounded-full">
                    {trulyAvailablePoints.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSetView('reclamados')}
                className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 min-w-[140px] text-sm
                  ${view === 'reclamados'
                    ? 'bg-yellow-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-yellow-700'}
                `}
              >
                Reclamados
                {claimedPoints.filter(p => p.claim_status === 'claimed').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-600 text-white rounded-full">
                    {claimedPoints.filter(p => p.claim_status === 'claimed').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSetView('cancelados')}
                className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 min-w-[140px] text-sm
                  ${view === 'cancelados'
                    ? 'bg-red-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'}
                `}
              >
                Cancelados
                {claimedPoints.filter(p => p.claim_status === 'cancelled').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-700 text-white rounded-full">
                    {claimedPoints.filter(p => p.claim_status === 'cancelled').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleSetView('retirados')}
                className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 min-w-[140px] text-sm
                  ${view === 'retirados'
                    ? 'bg-purple-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-700'}
                `}
              >
                Retirados
                {claimedPoints.filter(p => p.claim_status === 'completed').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-purple-700 text-white rounded-full">
                    {claimedPoints.filter(p => p.claim_status === 'completed').length}
                  </span>
                )}
              </button>
            </div>

            {/* Filtro de distancia para puntos disponibles */}
            {view === 'disponibles' && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Filtrar por Distancia</h3>
                
                <div className="flex flex-wrap items-center gap-4">
                  {/* Botón para obtener ubicación */}
                  <button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 text-sm ${
                      userLocation 
                        ? 'bg-green-100 text-green-800 border border-green-300' 
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
                  <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">
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
                  <h2 className="text-xl font-semibold text-green-700 mb-4">
                    Puntos Disponibles para Reclamar
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
                    {trulyAvailablePoints.length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">
                        No hay puntos disponibles para reclamar en este momento.
                      </div>
                    ) : (
                      trulyAvailablePoints.map(point => (
                        <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-green-400">
                          <div className="p-6">
                            {/* Info principal */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <img
                                  src={point.type === 'colective_point'
                                    ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
                                    : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png'}
                                  alt="Punto de Recolección"
                                  className="w-12 h-12 object-contain drop-shadow-lg animate-bounce mr-1 mt-0.2"
                                />
                                <div>
                                  <h3 className="text-lg font-bold text-green-800">{point.address}</h3>
                                  <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Botón Google Maps navegación usando coordenadas Mapbox */}
                                {/* Eliminado el botón de la esquina, solo se deja el botón junto a 'Ver en Mapa' */}
                              </div>
                            </div>
                            <div className="flex flex-row items-start mt-4">
                              <div className="mr-6 flex-shrink-0">
                                <div className="relative transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-green-300 hover:shadow-lg rounded-lg">
                                  <img
                                    src={point.photo_url || (point.type === 'colective_point'
                                      ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
                                      : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png')}
                                    alt={point.photo_url ? "Foto del material" : (point.type === 'colective_point' ? 'Contenedor Colectivo' : 'Reciclaje')}
                                    className="w-32 h-38 object-cover rounded-lg shadow-md border border-green-200"
                                    style={{ background: '#f0fdf4', filter: 'drop-shadow(0 4px 12px rgba(34,197,94,0.25))' }}
                                    onError={(e) => {
                                      // Si la imagen del material falla, usar la imagen por defecto
                                      const target = e.target as HTMLImageElement;
                                      target.src = point.type === 'colective_point'
                                        ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
                                        : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png';
                                      target.className = target.className.replace('object-cover', 'object-contain');
                                    }}
                                  />
                                 
                                  {/* Indicador de foto del material */}
                                  {point.photo_url && (
                                    <div className="absolute top-2 right-2">
                                      <div className="bg-green-500/80 text-white p-1 rounded-full shadow-lg backdrop-blur-sm border border-white/20" title="Foto del material">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {point.materials.map((material: string, idx: number) => (
                                    <span key={String(material) + '-' + idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm text-gray-500">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{point.schedule
                                ? (() => {
                                    // Si es una fecha válida, formatear en español
                                    const date = new Date(point.schedule);
                                    if (!isNaN(date.getTime())) {
                                      return date.toLocaleString('es-ES', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                      });
                                    }
                                    // Traducción manual para horarios tipo "Thursday, 07:30 - 17:00"
                                    const dias = [
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
                                      texto = texto.replace(new RegExp(d.en, 'g'), d.es);
                                    });
                                    return texto.replace(/\b(AM|PM)\b/gi, m => m.toLowerCase());
                                  })()
                                : ''}</span>
                            </div>
                            {/* Mostrar distancia si está disponible */}
                            {userLocation && (point as CollectionPoint & { calculatedDistance?: number }).calculatedDistance !== undefined && (
                              <div className="mt-2 flex items-center text-sm text-blue-600">
                                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">
                                  Distancia: {((point as CollectionPoint & { calculatedDistance?: number }).calculatedDistance)?.toFixed(1)} km de tu ubicación
                                </span>
                              </div>
                            )}
                            {/* Información adicional del residente */}
                            {typeof point.additional_info === 'string' && point.additional_info.trim() !== '' && (
                              <div className="mt-2 text-sm text-gray-600">
                                <strong>Información adicional:</strong> {point.additional_info}
                              </div>
                            )}
                            {/* Botón reclamar */}
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => handleOpenPickupModal(point)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow"
                              >
                                Reclamar
                              </button>
                              <div className="flex items-center">
                                {/* Botón Google Maps justo al lado */}
                                {typeof point.lng === 'number' && typeof point.lat === 'number' ? (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      const url = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    }}
                                    title="Abrir ruta de navegación en Google Maps"
                                    className="ml-2 flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-600 rounded hover:bg-green-100 transition-colors shadow-sm text-green-800 font-bold text-xs"
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
                  <hr className="my-10 border-green-300" />
                </div>
              )}
              {view === 'reclamados' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Reclamados</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {claimedPoints.filter(p => p.claim_status === 'claimed').length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">No tienes puntos reclamados.</div>
                    ) : (
                      claimedPoints.filter(p => p.claim_status === 'claimed').map(point => {
                        // Validación robusta de datos
                        const address = point.address || 'Sin dirección';
                        const district = point.district || 'Sin distrito';
                        const materials = Array.isArray(point.materials) ? point.materials : [];
                        const creator_avatar = point.creator_avatar || 'https://ui-avatars.com/api/?name=Residente&background=E0F2FE&color=2563EB&size=64';
                        const creator_name = typeof point.creator_name === 'string' ? point.creator_name : 'Residente';
                        const creator_email = point.creator_email || '';
                        const creator_dni = point.creator_dni || point.profiles?.dni || 'No informado';
                        const pickup_time = point.pickup_time ? new Date(point.pickup_time) : null;
                        // Render robusto
                        return (
                          <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="p-6">
                              {/* Info principal */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3">
                                  <img
                                    src={point.type === 'colective_point'
                                      ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
                                      : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png'}
                                    alt="Punto de Recolección"
                                    className="w-9 h-9 object-contain drop-shadow-lg animate-bounce mr-1 mt-0.5"
                                  />
                                  <div>
                                    <h3 className="text-lg font-medium text-gray-900">{address}</h3>
                                    <p className="mt-1 text-sm text-gray-500">{district}</p>
                                  </div>
                                </div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Reclamado</span>
                              </div>
                              <div className="flex flex-row justify-between items-start mt-4">
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {materials.map((material, idx) => (
                                      <span key={String(material) + '-' + idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                                    ))}
                                  </div>
                                </div>
                                <div className="ml-4 flex-shrink-0">
                                  <div className="relative transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-green-300 hover:shadow-lg rounded-lg">
                                    <img
                                      src={point.photo_url || (point.type === 'colective_point'
                                        ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                        : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png')}
                                      alt={point.photo_url ? "Foto del material" : (point.type === 'colective_point' ? 'Contenedor Colectivo' : 'Reciclaje')}
                                      className="w-28 h-28 object-cover rounded-lg shadow-md border border-green-200"
                                      style={{ background: '#f0fdf4' }}
                                      onError={(e) => {
                                        // Si la imagen del material falla, usar la imagen por defecto
                                        const target = e.target as HTMLImageElement;
                                        target.src = point.type === 'colective_point'
                                          ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                          : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png';
                                        target.className = target.className.replace('object-cover', 'object-contain');
                                      }}
                                    />
                                    
                                    {/* Indicador de foto del material */}
                                    {point.photo_url && (
                                      <div className="absolute top-2 right-2">
                                        <div className="bg-green-500/80 text-white p-1 rounded-full shadow-lg backdrop-blur-sm border border-white/20" title="Foto del material">
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4">
                                {pickup_time && (
                                  <div className="text-xs text-gray-500">Retiro programado: {pickup_time.toLocaleString()}</div>
                                )}
                                {/* CountdownTimer robusto */}
                                {point.status === 'claimed' && pickup_time && (
                                  <ErrorBoundary fallback={<div className="text-red-600 text-xs mt-2">⚠️ Error en el temporizador de retiro. Verifica la fecha/hora seleccionada.</div>}>
                                    <CountdownTimer 
                                      targetDate={pickup_time} 
                                      onComplete={() => {
                                        try {
                                          fetchData();
                                        } catch (e) {
                                          console.warn('Error al refrescar datos tras Countdown:', e);
                                        }
                                      }}
                                    />
                                  </ErrorBoundary>
                                )}
                                {/* Advertencia si el datapicker está mal configurado */}
                                {!pickup_time && <div className="text-yellow-600 text-xs mt-2">⚠️ Fecha/hora de retiro no configurada o inválida. Por favor, selecciona una fecha válida al reclamar el punto.</div>}
                              </div>
                              {/* Info residente */}
                              <div className="mt-6 pt-6 border-t border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Residente:</h4>
                                <div className="space-y-2">
                                  <div className="flex items-center text-sm text-gray-500">
                                    <img
                                      src={creator_avatar}
                                      alt={creator_name}
                                      className="h-7 w-7 rounded-full object-cover mr-2 border border-blue-200 shadow-sm"
                                    />
                                    <span>{creator_name}</span>
                                  </div>
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Mail className="h-4 w-4 mr-2" />
                                    <a href={`mailto:${creator_email}`} className="text-green-600 hover:text-green-700">{creator_email}</a>
                                  </div>
                                  {point.profiles?.phone && (
                                    <div className="flex items-center text-sm text-gray-500">
                                      <Phone className="h-4 w-4 mr-1" />
                                      <a href={`tel:${point.profiles.phone}`} className="text-green-600 hover:text-green-700">{point.profiles.phone}</a>
                                    </div>
                                  )}
                                  <div className="flex items-center text-sm text-gray-500">
                                    <span className="font-semibold mr-2">DNI:</span> {creator_dni}
                                  </div>
                                </div>
                              </div>
                              {/* Botones de acción */}
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    // Solo abrir el modal si ambos IDs son UUIDs válidos
                                    const isValidUuid = (id: string | null | undefined) => !!id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
                                    if (isValidUuid(point.claim_id) && isValidUuid(point.id)) {
                                      setSelectedClaim({ id: point.claim_id ?? '', pointId: point.id ?? '' });
                                      setShowCancelClaimModal(true);
                                    } else {
                                      setError('Error: No se puede cancelar, IDs inválidos.');
                                    }
                                  }}
                                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold shadow"
                                >
                                  Cancelar reclamo
                                </button>
                                <button
                                  onClick={() => {
                                    setPointToComplete(point);
                                    setShowCompleteModal(true);
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow"
                                >
                                  Marcar como retirado!
                                </button>
                                {typeof point.lng === 'number' && typeof point.lat === 'number' ? (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      const url = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    }}
                                    title="Abrir ruta de navegación en Google Maps"
                                    className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-600 rounded hover:bg-green-100 transition-colors shadow-sm text-green-800 font-bold text-xs"
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
                        );
                      })
                    )}
                  </div>
                </div>
              )}
              {view === 'cancelados' && (
                <div>
                  <div className="flex justify-end mb-4">
                    <button
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold shadow"
                      onClick={async () => {
                        if (!user) return;
                        // Filtrar puntos cancelados
                        const cancelados = claimedPoints.filter(p => p.claim_status === 'cancelled');
                        if (cancelados.length === 0) return;
                        if (!window.confirm('¿Estás seguro de que deseas vaciar los puntos cancelados? Esta acción no se puede deshacer. Los datos para estadísticas se conservarán.')) return;
                        // Clonar los puntos cancelados a una tabla de respaldo
                        for (const punto of cancelados) {
                          await supabase.from('collection_points_backup').insert({ 
                            ...punto, 
                            original_id: punto.id, 
                            deleted_at: new Date().toISOString(),
                            backup_reason: 'cancelled_cleanup'
                          });
                        }
                        // Ocultar puntos cancelados de la vista
                        setClaimedPoints(prev => prev.filter(p => p.claim_status !== 'cancelled'));
                      }}
                    >
                      Vaciar Puntos Cancelados
                    </button>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Cancelados</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {claimedPoints.filter(p => p.claim_status === 'cancelled').length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">No tienes puntos cancelados.</div>
                    ) : (
                      claimedPoints.filter(p => p.claim_status === 'cancelled').map(point => (
                        <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                          <div className="p-6">
                            {/* Info principal */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <img
                                  src={point.type === 'colective_point'
                                    ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                    : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png'}
                                  alt="Punto de Recolección"
                                  className="w-7 h-7 object-contain drop-shadow-lg animate-bounce mr-1 mt-0.5"
                                />
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">{point.address}</h3>
                                  <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Cancelado</span>
                            </div>
                            <div className="flex flex-row justify-between items-start mt-4">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {point.materials.map((material: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                <img
                                  src={point.type === 'colective_point'
                                    ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                    : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png'}
                                  alt={point.type === 'colective_point' ? 'Contenedor Colectivo' : 'Reciclaje'}
                                  className="w-28 h-28 object-contain bg-white shadow-none"
                                />
                              </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm text-gray-500">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{point.schedule}</span>
                            </div>
                            {point.cancelled_at && (
                              <div className="mt-2 text-xs text-gray-500">Cancelado el: {new Date(point.cancelled_at).toLocaleString()}</div>
                            )}
                            {point.cancellation_reason && (
                              <div className="mt-2 text-xs text-red-600 font-semibold">Motivo: {point.cancellation_reason}</div>
                            )}

                            {/* Info residente */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Residente:</h4>
                              <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-500">
                                  <img
                                    src={point.creator_avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(String(point.creator_name || 'Residente')) + '&background=E0F2FE&color=2563EB&size=64'}
                                    alt={typeof point.creator_name === 'string' ? point.creator_name : 'Residente'}
                                    className="h-7 w-7 rounded-full object-cover mr-2 border border-blue-200 shadow-sm"
                                  />
                                  <span>{point.creator_name}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <Mail className="h-4 w-4 mr-2" />
                                  <a href={`mailto:${point.creator_email}`} className="text-green-600 hover:text-green-700">{point.creator_email}</a>
                                </div>
                                {point.profiles?.phone && (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Phone className="h-4 w-4 mr-1" />
                                    <a href={`tel:${point.profiles.phone}`} className="text-green-600 hover:text-green-700">{point.profiles.phone}</a>
                                  </div>
                                )}
                                <div className="flex items-center text-sm text-gray-500">
                                  <span className="font-semibold mr-2">DNI:</span> {point.creator_dni || point.profiles?.dni || 'No informado'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {view === 'retirados' && (
                <div>
                  <div className="flex justify-end mb-4">
                   
                    <button
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold shadow"
                      onClick={async () => {
                        if (!user) return;
                        // Filtrar puntos retirados
                        const retirados = claimedPoints.filter(p => p.claim_status === 'completed');
                        if (retirados.length === 0) return;
                        if (!window.confirm('¿Estás seguro de que deseas vaciar los puntos retirados? Esta acción no se puede deshacer. Los datos para estadísticas se conservarán.')) return;
                        // Clonar los puntos retirados a una tabla de respaldo
                        for (const punto of retirados) {
                          await supabase.from('collection_points_backup').insert({ ...punto, original_id: punto.id, deleted_at: new Date().toISOString() });
                        }
                        // Ocultar puntos retirados de la vista
                        setClaimedPoints(prev => prev.filter(p => p.claim_status !== 'completed'));
                      }}
                    >
                      Vaciar Puntos
                    </button>
                  </div>
                  {/* Listado de puntos retirados */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {claimedPoints.filter(p => p.claim_status === 'completed').length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">No tienes puntos retirados.</div>
                    ) : (
                      claimedPoints.filter(p => p.claim_status === 'completed').map(point => (
                        <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-green-400">
                          <div className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <img
                                  src={point.type === 'colective_point'
                                    ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                    : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png'}
                                  alt="Punto de Recolección"
                                  className="w-7 h-7 object-contain drop-shadow-lg animate-bounce mr-1 mt-0.5"
                                />
                                <div>
                                  <h3 className="text-lg font-bold text-green-800">{point.address}</h3>
                                  <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Retirado</span>
                            </div>
                            <div className="flex flex-row items-start mt-4">
                              <div className="mr-6 flex-shrink-0">
                                <div className="relative transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-green-300 hover:shadow-lg rounded-lg">
                                  <img
                                    src={point.photo_url || (point.type === 'colective_point'
                                      ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                      : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png')}
                                    alt={point.photo_url ? "Foto del material" : (point.type === 'colective_point' ? 'Contenedor Colectivo' : 'Reciclaje')}
                                    className="w-36 h-36 object-cover rounded-lg shadow-md border border-green-200"
                                    style={{ background: '#f0fdf4', filter: 'drop-shadow(0 4px 12px rgba(34,197,94,0.25))' }}
                                    onError={(e) => {
                                      // Si la imagen del material falla, usar la imagen por defecto
                                      const target = e.target as HTMLImageElement;
                                      target.src = point.type === 'colective_point'
                                        ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750893817/contenedor_u6jjye.png'
                                        : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png';
                                      target.className = target.className.replace('object-cover', 'object-contain');
                                    }}
                                  />
                                  
                                  {/* Indicador de foto del material */}
                                  {point.photo_url && (
                                    <div className="absolute top-2 right-2">
                                      <div className="bg-green-500/80 text-white p-1 rounded-full shadow-lg backdrop-blur-sm border border-white/20" title="Foto del material">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {point.materials && Array.isArray(point.materials) && point.materials.map((material: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm text-gray-500">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{point.pickup_time ? new Date(point.pickup_time).toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>
                            {/* Información adicional del residente */}
                            {typeof point.additional_info === 'string' && point.additional_info.trim() !== '' && (
                              <div className="mt-2 text-sm text-gray-600">
                                <strong>Información adicional:</strong> {point.additional_info}
                              </div>
                            )}
                            {/* Info residente */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Residente:</h4>
                              <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-500">
                                  <img
                                    src={point.creator_avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(String(point.creator_name || 'Residente')) + '&background=E0F2FE&color=2563EB&size=64'}
                                    alt={typeof point.creator_name === 'string' ? point.creator_name : 'Residente'}
                                    className="h-7 w-7 rounded-full object-cover mr-2 border border-blue-200 shadow-sm"
                                  />
                                  <span>{point.creator_name}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <Mail className="h-4 w-4 mr-2" />
                                  <a href={`mailto:${point.creator_email}`} className="text-green-600 hover:text-green-700">{point.creator_email}</a>
                                </div>
                                {point.profiles?.phone && (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Phone className="h-4 w-4 mr-1" />
                                    <a href={`tel:${point.profiles.phone}`} className="text-green-600 hover:text-green-700">{point.profiles.phone}</a>
                                  </div>
                                )}
                                <div className="flex items-center text-sm text-gray-500">
                                  <span className="font-semibold mr-2">DNI:</span> {point.creator_dni || point.profiles?.dni || 'No informado'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
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
                          // iconSize: [50, 50] // Ajuste del tamaño del ícono (eliminado porque no es una propiedad válida)
                        }
                      ]}
                      showUserLocation={true}
                      showRoute={true}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Modal cancelar reclamo */}
            {showCancelClaimModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cancelar Reclamación</h3>
                  <div className="mb-4">
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">Motivo de la cancelación</label>
                    <input
                      id="reason"
                      name="reason"
                      type="text"
                      value={cancellationReason}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCancellationReason(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                      placeholder="Motivo (opcional)"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowCancelClaimModal(false);
                        setSelectedClaim(null);
                        setCancellationReason('');
                      }}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCancelClaim}
                      disabled={!cancellationReason.trim()}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirmar Cancelación
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Modal de retiro exitoso */}
            {showCompleteModal && pointToComplete && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Retiro Exitoso</h3>
                    <button
                      onClick={() => {
                        setShowCompleteModal(false);
                        setPointToComplete(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Has marcado el punto como retirado. El residente será notificado automáticamente.</p>
                  <div className="flex justify-end">
                    <button
                      onClick={handleCompleteCollection}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Procesando...' : 'Aceptar y Notificar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Modal para programar recolección */}
            {showPickupModal && pointToClaim && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Programar Recolección</h3>
                    <button
                      onClick={() => {
                        setShowPickupModal(false);
                        setPointToClaim(null);
                        setError(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Punto: <span className="font-semibold">{pointToClaim?.address || ''}</span></p>
                  <p className="text-sm text-gray-600 mb-4">Distrito: <span className="font-semibold">{pointToClaim?.district || ''}</span></p>

                  <div className="mb-4">
                    <label htmlFor="pickupDateTime" className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha y Hora de Recolección <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="datetime-local"
                        id="pickupDateTime"
                        value={pickupDateTimeInput}
                        onChange={(e) => setPickupDateTimeInput(e.target.value)}
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 pl-10 focus:ring-green-500 focus:border-green-500"
                        min={new Date().toISOString().slice(0, 16)} // Evitar fechas pasadas
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-4">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowPickupModal(false);
                        setPointToClaim(null);
                        setError(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmClaim}
                      disabled={loading || !pickupDateTimeInput}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      {loading ? 'Procesando...' : 'Confirmar Reclamo'}
                    </button>
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
            {showPointsStatsModal && profileId && (
              <MyRecyclerRatingsModal
                open={showPointsStatsModal}
                onClose={() => setShowPointsStatsModal(false)}
                recyclerId={profileId}
                recyclerName={user.name}
                avatarUrl={user.avatar_url}
              />
            )}
            {showChatModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Mensajes con Residentes</h3>
                    <button onClick={() => setShowChatModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                  </div>
                  {/* Lista de residentes con los que el reciclador tiene puntos reclamados o historial de mensajes */}
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
            {showRouteModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg w-full max-w-3xl mx-4 p-6 relative">
                  <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
                    onClick={() => { setShowRouteModal(false); setActiveRoute(null); setCreatingRoute(false); setRouteError(null); setRouteSuccess(null); setEditingRoute(null); }}
                    title="Cerrar"
                  >
                    ×
                  </button>
                  <h2 className="text-2xl font-bold text-cyan-700 mb-4">Mis Rutas</h2>
                  {routeError && <div className="text-red-600 mb-2">{routeError}</div>}
                  {routeSuccess && <div className="text-green-600 mb-2">{routeSuccess}</div>}
                  {/* --- FORMULARIO DE EDICIÓN DE RUTA --- */}
                  {editingRoute ? (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Editar ruta</h3>
                      <input
                        className="border px-3 py-2 rounded w-full mb-2"
                        placeholder="Nombre de la ruta"
                        value={editRouteName}
                        onChange={e => setEditRouteName(e.target.value)}
                      />
                      <div className="mb-2 text-sm text-gray-600">Selecciona los puntos reclamados (mínimo 2):</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                        {claimedPoints.length === 0 && <div className="col-span-2 text-gray-400">No tienes puntos reclamados.</div>}
                        {claimedPoints.map(point => (
                          <label key={point.id} className={`flex items-center gap-2 border rounded px-2 py-1 cursor-pointer ${editSelectedPoints.includes(point.id) ? 'bg-green-100 border-green-400' : 'bg-white'}`}>
                            <input
                              type="checkbox"
                              checked={editSelectedPoints.includes(point.id)}
                              onChange={() => toggleEditSelectPoint(point.id)}
                              className="accent-green-600"
                            />
                            <span>{String(point.creator_name || 'Punto')} ({point.lat?.toFixed(4)}, {point.lng?.toFixed(4)})</span>
                          </label>
                        ))}
                      </div>
                      {editRouteError && <div className="text-red-600 mb-2">{editRouteError}</div>}
                      {editRouteSuccess && <div className="text-green-600 mb-2">{editRouteSuccess}</div>}
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                          onClick={handleCancelEditRoute}
                          disabled={editRouteLoading}
                        >Cancelar</button>
                        <button
                          className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 font-semibold"
                          onClick={handleSaveEditRoute}
                          disabled={editRouteLoading}
                        >Guardar cambios</button>
                      </div>
                    </div>
                  ) : creatingRoute ? (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Crear nueva ruta</h3>
                      <input
                        className="border px-3 py-2 rounded w-full mb-2"
                        placeholder="Nombre de la ruta"
                        value={newRouteName}
                        onChange={e => setNewRouteName(e.target.value)}
                      />
                      <div className="mb-2 text-sm text-gray-600">Selecciona los puntos reclamados (mínimo 2):</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                        {claimedPoints.length === 0 && <div className="col-span-2 text-gray-400">No tienes puntos reclamados.</div>}
                        {claimedPoints.map(point => (
                          <label key={point.id} className={`flex items-center gap-2 border rounded px-2 py-1 cursor-pointer ${selectedRoutePoints.includes(point.id) ? 'bg-green-100 border-green-400' : 'bg-white'}`}>
                            <input
                              type="checkbox"
                              checked={selectedRoutePoints.includes(point.id)}
                              onChange={() => toggleSelectPoint(point.id)}
                              className="accent-green-600"
                            />
                            <span>{String(point.creator_name || 'Punto')} ({point.lat?.toFixed(4)}, {point.lng?.toFixed(4)})</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                          onClick={() => { setCreatingRoute(false); setNewRouteName(''); setSelectedRoutePoints([]); }}
                          disabled={routeLoading}
                        >Cancelar</button>
                        <button
                          className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 font-semibold"
                          onClick={handleSaveRoute}
                          disabled={routeLoading}
                        >Guardar ruta</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <button
                          className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded hover:bg-cyan-200 font-semibold"
                          onClick={() => { setCreatingRoute(true); setNewRouteName(''); setSelectedRoutePoints([]); setRouteError(null); setRouteSuccess(null); }}
                        >+ Nueva ruta</button>
                      </div>
                      {routeLoading ? (
                        <div className="text-gray-500">Cargando rutas...</div>
                      ) : routes.length === 0 ? (
                        <div className="text-gray-400">No tienes rutas guardadas.</div>
                      ) : (
                        <div className="mb-4">
                          <ul className="divide-y">
                            {routes.map(route => (
                              <li key={route.id} className="py-2 flex items-center justify-between gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => setActiveRoute(route)}>
                                  <span className="font-semibold text-cyan-700">{route.name}</span>
                                  <span className="ml-2 text-xs text-gray-500">{route.points?.length} puntos</span>
                                </div>
                                <button
                                  className="text-blue-500 hover:text-blue-700 text-sm ml-2"
                                  onClick={() => handleEditRoute(route)}
                                  title="Editar ruta"
                                >Editar</button>
                                <button
                                  className="text-red-500 hover:text-red-700 text-sm ml-2"
                                  onClick={() => handleDeleteRoute(route.id)}
                                  title="Eliminar ruta"
                                >Eliminar</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {activeRoute && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Ruta seleccionada: {activeRoute.name}</h4>
                          <div className="w-full h-80 rounded overflow-hidden border">
                            {(() => {
                              // Obtener los puntos de la ruta en orden usando point_ids y datos completos de claimedPoints
                              const routePoints = (activeRoute.point_ids || [])
                                .map((pid: string) => claimedPoints.find(p => p.id === pid))
                                .filter(Boolean);
                              // Si falta algún punto, mostrar advertencia
                              if (routePoints.length < (activeRoute.point_ids?.length || 0)) {
                                return <div className="p-4 text-red-600">Algunos puntos de la ruta ya no existen.</div>;
                              }
                              // Marcadores con info visual
                              const markerPoints = routePoints.map(p => ({
                                id: p!.id,
                                lat: Number(p!.lat),
                                lng: Number(p!.lng),
                                title: String(p!.address || 'Punto'),
                                avatar_url: p!.creator_avatar || 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png',
                                iconUrl: p!.claim_status === 'claimed' 
                                  ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750101287/Punto_de_Recoleccion_reclamado_Marcador_m3c4rd.png' 
                                  : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png',
                                iconsize: [96, 96],
                                status: p!.claim_status,
                              }));
                              // Array de lat/lng para el trazado de la ruta
                              const routeLine = routePoints.map(p => ({ lat: Number(p!.lat), lng: Number(p!.lng) }));
                              if (routeLine.length < 2) {
                                return <div className="p-4 text-gray-500">Selecciona al menos 2 puntos para ver la ruta.</div>;
                              }
                              return (
                                <MapComponent
                                  markers={markerPoints}
                                  route={routeLine}
                                  showUserLocation={false}
                                  showRoute={true}
                                />
                              );
                            })()}
                          </div>
                          <button
                            className="mt-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                            onClick={() => setActiveRoute(null)}
                          >Ocultar ruta</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardRecycler;









