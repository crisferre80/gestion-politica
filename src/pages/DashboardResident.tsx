import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Calendar, Plus, User as UserIcon, Mail, Phone } from 'lucide-react';
import { supabase, ensureUserProfile, cancelClaim } from '../lib/supabase';
import Map from '../components/Map';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast'; // O tu sistema de notificaciones favorito
import RecyclerRatingsModal from '../components/RecyclerRatingsModal';
import PhotoCapture from '../components/PhotoCapture';

// Tipo para el payload de realtime de perfiles
export type ProfileRealtimePayload = {
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
  // otros campos...
};

const DashboardResident: React.FC = () => {
  const { user, login } = useUser();
  const location = useLocation();
  // const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
   
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
  const avatarUrl = user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.name || 'Residente') + '&background=22c55e&color=fff&size=128';

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
    const channel = supabase.channel('recyclers-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'role=eq.recycler',
        },
        (payload) => {
          const newRec = payload.new as ProfileRealtimePayload;
          const oldRec = payload.old as ProfileRealtimePayload;
          if (newRec && newRec.role && newRec.role.toLowerCase() === 'recycler') {
            setRecyclers((prev) => {
              // --- Solo actualiza si cambia online, lat, lng o info relevante ---
              const exists = prev.find(r => r.id === String(newRec.id));
              const normalizedMaterials = Array.isArray(newRec.materials)
                ? newRec.materials
                : (typeof newRec.materials === 'string' && newRec.materials.length > 0
                    ? [newRec.materials]
                    : []);
              const normalizedOnline = newRec.online === true || newRec.online === 'true' || newRec.online === 1;
              const normalizedLat = typeof newRec.lat === 'number' ? newRec.lat : (newRec.lat !== null && newRec.lat !== undefined ? Number(newRec.lat) : undefined);
              const normalizedLng = typeof newRec.lng === 'number' ? newRec.lng : (newRec.lng !== null && newRec.lng !== undefined ? Number(newRec.lng) : undefined);
              const safeRole = typeof newRec.role === 'string' ? newRec.role : 'recycler';
              if (exists) {
                // Solo actualiza si cambia online, lat, lng o info relevante
                return prev.map(r =>
                  r.id === String(newRec.id)
                    ? {
                        ...r,
                        online: normalizedOnline,
                        lat: normalizedLat,
                        lng: normalizedLng,
                        materials: normalizedMaterials,
                        profiles: {
                          ...r.profiles,
                          ...newRec,
                          avatar_url: newRec.avatar_url || r.profiles?.avatar_url,
                          name: newRec.name || r.profiles?.name,
                          email: newRec.email || r.profiles?.email,
                          phone: newRec.phone || r.profiles?.phone,
                        },
                      }
                    : r
                ).filter(r => r.online === true); // Solo deja online
              } else {
                // Solo agrega si está online
                if (normalizedOnline) {
                  return [
                    ...prev,
                    {
                      id: String(newRec.id),
                      user_id: newRec.user_id,
                      role: safeRole,
                      profiles: {
                        avatar_url: newRec.avatar_url,
                        name: newRec.name,
                        email: newRec.email,
                        phone: newRec.phone,
                      },
                      rating_average: newRec.rating_average,
                      total_ratings: newRec.total_ratings,
                      materials: normalizedMaterials,
                      bio: newRec.bio,
                      lat: normalizedLat,
                      lng: normalizedLng,
                      online: normalizedOnline,
                    },
                  ];
                } else {
                  return prev;
                }
              }
            });
          }
          if (payload.eventType === 'DELETE' && oldRec && oldRec.role && oldRec.role.toLowerCase() === 'recycler') {
            setRecyclers((prev) => prev.filter((r) => r.id !== String(oldRec.id)));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Estado para la pestaña activa (activeTab)
  const [activePointsTab, setActivePointsTab] = useState<'todos' | 'disponibles' | 'reclamados' | 'demorados' | 'retirados'>('todos');
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
      };
    };
  };
  const [detailedPoints, setDetailedPoints] = useState<DetailedPoint[]>([]);

  // Cargar puntos con detalles de reclamo y reciclador
  useEffect(() => {
    if (!user?.id) return;
    // Asegura que el perfil existe antes de cargar puntos
    ensureUserProfile({ id: user.id, email: user.email, name: user.name });
    const fetchDetailedPoints = async () => {
      // CORREGIDO: select anidado con el nombre correcto de la foreign key y orden explícito
      const { data, error } = await supabase
        .from('collection_points')
        .select(`*,claim:collection_claims!collection_point_id(*,recycler:profiles!recycler_id(id,user_id,name,avatar_url,email,phone))`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setDetailedPoints(data);
      } else setDetailedPoints([]);
    };
    fetchDetailedPoints();

    const channelPoints = supabase.channel('resident-collection-points')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_points',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchDetailedPoints();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_claims',
      }, () => {
        fetchDetailedPoints();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channelPoints);
    };
  }, [user]);

  // Filtrado por sub-tab
  const now = new Date();
  // Normaliza claim: si es array, toma el primero; si es objeto, lo deja igual
type ClaimType = {
  id?: string;
  status?: string;
  pickup_time?: string;
  recycler?: {
    id?: string;
    user_id?: string;
    name?: string;
    avatar_url?: string;
    email?: string;
    phone?: string;
  };
} | null;

const normalizeClaim = (claim: ClaimType | ClaimType[] | null | undefined): ClaimType => {
  if (Array.isArray(claim)) return claim[0] || null;
  return claim || null;
};

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
  return false;
});

  // DEBUG LOGS
  // console.log('[DEBUG] puntosTodos:', puntosTodos.map(p => p.id));
  // console.log('[DEBUG] puntosReclamados:', puntosReclamados.map(p => p.id));
  // console.log('[DEBUG] puntosRetirados:', puntosRetirados.map(p => p.id));
  // console.log('[DEBUG] puntosDemorados:', puntosDemorados.map(p => p.id));

  // Función para volver a poner un punto como disponible
  const handleMakeAvailableAgain = async (point: DetailedPoint) => {
    try {
      const claimId = point.claim_id || point.claim?.id;
      if (claimId) {
        await cancelClaim(claimId, point.id, 'Cancelado por el residente');
        toast.success('El punto está disponible nuevamente.');
        // Actualiza el estado local para UX instantánea
        setDetailedPoints(prev => prev.map(p => {
                  if (p.id === point.id) {
                    return {
                      ...p,
                      status: 'available',
                      claim: undefined,
                      claim_id: null
                    };
                  }
                  return p;
                }));
      } else {
        toast.error('No se encontró un reclamo activo para cancelar.');
      }
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
      // refreshCollectionPoints();
    } catch (err) {
      toast.error('Error al eliminar el punto.');
      console.error(err);
    }
  };

// --- Calificación de recicladores ---
const [showRatingsModal, setShowRatingsModal] = useState(false);
const [ratingsModalTarget, setRatingTarget] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string } | null>(null);

// (Eliminado estado no utilizado: selectedRecycler)

  useEffect(() => {
    // Refresca puntos si se navega with el flag refresh (tras crear un punto)
    if (location.state && location.state.refresh) {
      // refreshCollectionPoints(); // Eliminar o comentar
      // Limpia el state para evitar refrescos innecesarios al navegar de nuevo
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const getAvatarUrl = (url: string | undefined) =>
  url ? url.replace('/object/avatars/', '/object/public/avatars/') : undefined;

  // Estado para mostrar el modal de eliminar cuenta
  const [, setShowDeleteAccount] = useState(false);

  // Definir estados para edición de perfil
const [editName, setEditName] = useState(user?.name || '');
const [editEmail, setEditEmail] = useState(user?.email || '');
const [editPhone, setEditPhone] = useState(user?.phone || '');
const [editAddress, setEditAddress] = useState(user?.address || '');
const [editBio, setEditBio] = useState(user?.bio || '');
const [editMaterials, setEditMaterials] = useState(user?.materials?.join(', ') || '');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-2">
      {/* Mostrar mensaje de error si existe */}
      {error && (
        <div className="mb-4 w-full max-w-2xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {/* Mostrar mensaje de éxito si existe */}
      {/* Header con nombre, foto y rol */}
      <div className="w-full flex items-center justify-between bg-white shadow rounded-t-lg px-4 py-2 mb-4">
        <h2 className="text-xl font-bold text-green-700">Panel de Residente</h2>
      </div>
      <div className="flex items-center gap-4 mb-8 bg-white shadow rounded-lg px-6 py-4 w-full max-w-2xl">
        <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 border-2 border-green-600">
          <img
            src={getAvatarUrl(user?.avatar_url || avatarUrl)}
            alt="Foto de perfil"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-700">{user?.name || 'Residente'}</h2>
          <p className="text-gray-500 capitalize">{user?.type === 'resident' ? 'Residente' : user?.type || 'Usuario'}</p>
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
          <div className="mb-4 flex gap-2">
            <button onClick={() => setActivePointsTab('todos')} className={`px-3 py-1 rounded ${activePointsTab==='todos'?'bg-green-600 text-white':'bg-gray-100 text-gray-700'}`}>Disponibles</button>
            <button onClick={() => setActivePointsTab('reclamados')} className={`px-3 py-1 rounded ${activePointsTab==='reclamados'?'bg-green-600 text-white':'bg-gray-100 text-gray-700'}`}>Puntos reclamados</button>
            <button onClick={() => setActivePointsTab('demorados')} className={`px-3 py-1 rounded ${activePointsTab==='demorados'?'bg-green-600 text-white':'bg-gray-100 text-gray-700'}`}>Puntos demorados</button>
            <button onClick={() => setActivePointsTab('retirados')} className={`px-3 py-1 rounded ${activePointsTab==='retirados'?'bg-green-600 text-white':'bg-gray-100 text-gray-700'}`}>Puntos retirados</button>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Mis Puntos de Recolección</h2>
            {/* Enlace para agregar punto: elimina el paso de función por state */}
            <Link
              to="/add-collection-point"
              className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700 focus:ring-2 focus:ring-green-400 focus:outline-none shadow-md transition-all duration-200 w-fit mb-4 group"
              style={{ minWidth: 'unset', maxWidth: '220px' }}
            >
              <Plus className="h-4 w-4 mr-1 group-hover:rotate-90 transition-transform duration-300" />
              <span>Agregar Punto</span>
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
                        {/* Botón para volver a disponible SOLO en puntos retirados, esquina superior derecha */}
                        {activePointsTab === 'retirados' && (
                          <button
                            className="absolute top-28 right-4 z-10 px-1 py-1 bg-green-600 text-white rounded shadow-md hover:bg-green-700 transition-all"
                            onClick={() => handleMakeAvailableAgain(point)}
                            type="button"
                          >
                            Volver a disponible
                          </button>
                        )}
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
                            <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 shadow-sm">
                              <img
                                src={claim.recycler.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(claim.recycler.name || 'Reciclador') + '&background=FACC15&color=fff&size=64'}
                                alt="Avatar reciclador"
                                className="w-10 h-10 rounded-full border-2 border-yellow-400 object-cover"
                              />
                              <div className="flex flex-col">
                            {/* Botón 'Ver reciclador' eliminado porque setSelectedRecycler no está definido */}
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
                        {/* Eliminar NO se muestra si está reclamado */}
                        <div className="flex-shrink-0 md:ml-4 mt-4 md:mt-0 flex items-center">
                          {/* No mostrar botón eliminar si está reclamado */}
                        </div>
                        {/* Botón para volver a disponible solo en tab demorados */}
                        {activePointsTab === 'demorados' && (
                          <button
                            onClick={() => handleMakeAvailableAgain(point)}
                            className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-md animate-bounce"
                          >
                         Disponible
                          </button>
                        )}
                        {/* Botón para calificar reciclador en puntos retirados */}
                        {activePointsTab === 'retirados' && point.claim && point.claim.recycler && (
                          <>
                            {(() => {
                              const recyclerId = point.claim?.recycler?.id || '';
                              const recyclerName = point.claim?.recycler?.name || 'Reciclador';
                              function handleOpenDonation() {
                                toast('Funcionalidad de donación no implementada aún.');
                              }

                              return (
                                <>
                                  <button
                                    className="mt-2 px-4 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500 shadow-md"
                                    onClick={() => {
                                      setRatingTarget({ recyclerId, recyclerName, avatarUrl: point.claim?.recycler?.avatar_url });
                                      setShowRatingsModal(true);
                                    }}
                                  >
                                    Calificar reciclador
                                  </button>
                                  <button
                                    className="mt-2 ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md"
                                    onClick={() => handleOpenDonation()}
                                    type="button"
                                  >
                                    Donar
                                  </button>
                                  {/* BOTÓN PARA VOLVER A DISPONIBLE UN PUNTO RETIRADO */}
                                
                                </>
                              );
                            })()}
                          </>
                        )}
                        {/* Eliminar SOLO se muestra si el punto está disponible (no reclamado ni retirado) */}
{(!isClaimed && point.status !== 'completed') && (
  <button
    className="ml-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow-md"
    onClick={() => handleDeletePoint(point)}
    type="button"
  >
    Eliminar
  </button>
)}
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
              points={recyclers
                .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number' && r.online === true)
                .map((rec) => ({
                  id: rec.id.toString(),
                  lat: rec.lat ?? 0,
                  lng: rec.lng ?? 0,
                  title: rec.profiles?.name || 'Reciclador',
                  avatar_url: rec.profiles?.avatar_url || undefined,
                  role: 'recycler',
                  online: rec.online === true,
                  bikeIconUrl: 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1747537980/bicireciclador-Photoroom_ij5myq.png'
                }))}
              showUserLocation={true}
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
                <div key={rec.id} className="border rounded-lg p-4 flex flex-col items-center bg-gray-50 shadow-sm">
                  <div className="w-20 h-20 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
                    {rec.profiles?.avatar_url ? (
                      <img src={rec.profiles.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-green-700 mb-1 flex items-center gap-2">
                    {rec.profiles?.name || 'Reciclador'}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold animate-pulse ml-2">
                      <span className="w-2 h-2 bg-white rounded-full mr-1"></span>En línea
                    </span>
                  </h3>
                  <p className="text-gray-500 text-sm mb-1 flex items-center"><Mail className="h-4 w-4 mr-1" />{rec.profiles?.email}</p>
                  {rec.profiles?.phone && <p className="text-gray-500 text-sm mb-1 flex items-center"><Phone className="h-4 w-4 mr-1" />{rec.profiles.phone}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {rec.materials?.map((mat: string, idx: number) => (
                      <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">{mat}</span>
                    ))}
                  </div>
                  {rec.bio && <p className="text-gray-600 text-xs mt-2 text-center">{rec.bio}</p>}
                  {/* Validación de UUID para el chat */}
                  {rec.user_id && /^[0-9a-fA-F-]{36}$/.test(rec.user_id) ? (
                    <Link
                      to={`/chat/${rec.user_id}`}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      Enviar mensaje
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
                    materials: editMaterials.split(',').map((m: string) => m.trim()).filter(Boolean),
                    lat: user!.lat,
                    lng: user!.lng,
                    online: user!.online,
                    type: user!.type,
                    role: user!.role,
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
              onCapture={file => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                  setError('Solo se permiten imágenes JPG, PNG, GIF o WEBP.');
                  return;
                }
                if (file.size > 2 * 1024 * 1024) {
                  setError('El archivo debe pesar menos de 2 MB.');
                  return;
                }
                setError(null);
                // Aquí iría la lógica de subida real
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
    </div>
  );
};

export default DashboardResident;

