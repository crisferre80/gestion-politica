import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Calendar, Plus, Trash2, Clock, User as UserIcon, Mail, Phone, Star } from 'lucide-react';
import { supabase, deleteCollectionPoint, ensureUserProfile } from '../lib/supabase';
// Importa uploadProfilePhoto desde el módulo correcto si existe, por ejemplo:
// import { uploadProfilePhoto } from '../lib/uploadProfilePhoto';
import Map from '../components/Map';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast'; // O tu sistema de notificaciones favorito
import NotificationBell from '../components/NotificationBell';
import { createNotification } from '../lib/notifications';
import RecyclerRatingsModal from '../components/RecyclerRatingsModal';
import AdminNotifications from '../components/AdminNotifications';
import PhotoCapture from '../components/PhotoCapture';

// Tipo para el payload de realtime de perfiles
export type ProfileRealtimePayload = {
  id: number;
  avatar_url?: string;
  name?: string;
  email?: string;
  phone?: string;
  rating_average?: number;
  total_ratings?: number;
  materials?: string[];
  bio?: string;
  lat?: number;
  lng?: number;
  online?: boolean;
  role?: string;
};

type CollectionPoint = {
  additional_info: boolean;
  notas: string;
  id: number;
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
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'puntos' | 'recicladores' | 'perfil' | 'historial'>('puntos');
  // eslint-disable-next-line no-empty-pattern
  const [] = useState<{ id: number; name: string } | null>(null);
  // const [chatOpen, setChatOpen] = useState(false);
  // const [chatRecyclerId] = useState<number | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // const [] = useState(false);
  // const [] = useState(false);
  type Recycler = {
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
  
    const [recyclers, setRecyclers] = useState<Recycler[]>([]);
  const [loadingRecyclers, setLoadingRecyclers] = useState(false);
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

  // --- EXTRACTED FETCH RECYCLERS FUNCTION ---
  const fetchRecyclers = async () => {
    setLoadingRecyclers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, avatar_url, name, email, phone, materials, bio, lat, lng, online, role, user_id, rating_average, total_ratings')
      .eq('role', 'recycler');
    console.log('Recyclers fetched from Supabase:', data, error); // DEBUG
    if (error) {
      setRecyclers([]);
    } else {
      setRecyclers(
        (data || []).map((rec) => ({
          id: String(rec.id), // <-- Forzamos a string
          user_id: rec.user_id || rec.id,
          profiles: {
            avatar_url: rec.avatar_url,
            name: rec.name,
            email: rec.email,
            phone: rec.phone,
          },
          rating_average: rec.rating_average || 0,
          total_ratings: rec.total_ratings || 0,
          materials: Array.isArray(rec.materials) ? rec.materials : (typeof rec.materials === 'string' && rec.materials.length > 0 ? [rec.materials] : []),
          bio: typeof rec.bio === 'string' ? rec.bio : '',
          lat: rec.lat !== null && rec.lat !== undefined ? Number(rec.lat) : undefined,
          lng: rec.lng !== null && rec.lng !== undefined ? Number(rec.lng) : undefined,
          online: rec.online === true || rec.online === 'true' || rec.online === 1,
        }))
      );
    }
    setLoadingRecyclers(false);
  };

  useEffect(() => {
    if (activeTab === 'recicladores') {
      fetchRecyclers();
      // SUSCRIPCIÓN EN TIEMPO REAL PARA ACTUALIZAR CARDS
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
                const exists = prev.find((r) => r.id === String(newRec.id));
                if (exists) {
                  // Actualiza el reciclador existente
                  return prev.map((r) =>
                    r.id === String(newRec.id)
                      ? {
                          ...r,
                          id: String(newRec.id),
                          profiles: {
                            avatar_url: newRec.avatar_url,
                            name: newRec.name,
                            email: newRec.email,
                            phone: newRec.phone,
                          },
                          rating_average: newRec.rating_average || 0,
                          total_ratings: newRec.total_ratings || 0,
                          materials: newRec.materials || [],
                          bio: newRec.bio || '',
                          lat: newRec.lat,
                          lng: newRec.lng,
                          online: newRec.online,
                        }
                      : r
                  );
                } else {
                  // Nuevo reciclador
                  return [
                    ...prev,
                    {
                      id: String(newRec.id),
                      profiles: {
                        avatar_url: newRec.avatar_url,
                        name: newRec.name,
                        email: newRec.email,
                        phone: newRec.phone,
                      },
                      rating_average: newRec.rating_average || 0,
                      total_ratings: newRec.total_ratings || 0,
                      materials: newRec.materials || [],
                      bio: newRec.bio || '',
                      lat: newRec.lat,
                      lng: newRec.lng,
                      online: newRec.online,
                    },
                  ];
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
    }
  }, [activeTab]);

  // Polling para actualizar recicladores en tiempo real
  useEffect(() => {
    if (activeTab !== 'puntos') return;

    const fetchRecyclersRealtime = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      if (!error && data) {
        setRecyclers(
          (data || [])
            .filter(rec => rec.role && rec.role.toLowerCase() === 'recycler')
            .map((rec) => ({
              id: rec.id,
              profiles: {
                avatar_url: rec.avatar_url,
                name: rec.name,
                email: rec.email,
                phone: rec.phone,
              },
              rating_average: rec.rating_average || 0,
              total_ratings: rec.total_ratings || 0,
              materials: Array.isArray(rec.materials) ? rec.materials : (typeof rec.materials === 'string' && rec.materials.length > 0 ? [rec.materials] : []),
              bio: typeof rec.bio === 'string' ? rec.bio : '',
              lat: rec.lat !== null && rec.lat !== undefined ? Number(rec.lat) : undefined,
              lng: rec.lng !== null && rec.lng !== undefined ? Number(rec.lng) : undefined,
              online: rec.online === true || rec.online === 'true' || rec.online === 1,
            }))
        );
      }
    };

    const interval = setInterval(fetchRecyclersRealtime, 5000); // cada 5 segundos
    fetchRecyclersRealtime();
    return () => clearInterval(interval);
  }, [activeTab]);

  // Refresca los puntos de recolección y detalles
  const refreshCollectionPoints = React.useCallback(async () => {
    if (!user?.id) return;
    // Actualiza collectionPoints
    const { data, error } = await supabase
      .from('collection_points')
      .select('*')
      .eq('user_id', user.id);
    if (!error && data) setDetailedPoints(data); // Corrige: solo actualiza el estado, no elimina puntos
    // Actualiza detailedPoints
    const { data: detailed, error: errorDetailed } = await supabase
      .from('collection_points')
      .select(`*,
        claim:collection_claims!claim_id (*, recycler:profiles!collection_claims_recycler_id_fkey (user_id, name, avatar_url, email, phone))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!errorDetailed && detailed) setDetailedPoints(detailed);
  }, [user?.id]);

  const handleDelete = async (pointId: number) => {
    if (!user?.id) {
      setError('Usuario no autenticado');
      return;
    }
    setIsDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCollectionPoint(pointId.toString());
      setSuccess('Punto de recolección eliminado con éxito');
      await refreshCollectionPoints(); // Refresca lista tras eliminar
    } catch {
      setError('Error al eliminar el punto de recolección');
    }
    setIsDeleting(false);
  };

  // Hooks de estado para los campos editables
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editMaterials, setEditMaterials] = useState(user?.materials?.join(', ') || '');
  
  // const [editDni, setEditDni] = useState(user?.dni || ''); // Si tienes campo dni

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new;
          // Notifica solo si el mensaje es para este usuario y no lo envió él mismo
          if (msg.receiver_id === user.id && msg.sender_id !== user.id) {
            toast.success('¡Nuevo mensaje recibido!');
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Función para eliminar cuenta
  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeletingAccount(true);
    // Elimina el perfil y el usuario de Supabase
    await supabase.from('profiles').delete().eq('user_id', user.id);
    // Si usas Supabase Auth, elimina también el usuario autenticado:
    await supabase.auth.admin.deleteUser(user.id); // Solo funciona si tienes permisos de admin
    setDeletingAccount(false);
    // Redirige o desloguea
    window.location.href = '/';
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      if (!user?.id) return;
      await uploadProfilePhoto(file, user);
      // Obtener el perfil actualizado
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (!error && updatedProfile) {
        // Normaliza los campos según el UserContext
        login({
          ...user,
          ...updatedProfile,
          type: updatedProfile.role || user.type,
          materials: Array.isArray(updatedProfile.materials)
            ? updatedProfile.materials
            : (typeof updatedProfile.materials === 'string' && updatedProfile.materials.length > 0
                ? [updatedProfile.materials]
                : []),
          bio: typeof updatedProfile.bio === 'string' ? updatedProfile.bio : '',
        });
        toast.success('Foto actualizada correctamente');
      } else {
        toast.error('Error al actualizar el usuario');
      }
      // No recargar la página
    } catch (err) {
      toast.error('Error al subir la foto');
      console.error(err);
    }
  };

  const [activePointsTab, setActivePointsTab] = useState<'todos' | 'reclamados' | 'demorados' | 'retirados'>('todos');
  type DetailedPoint = CollectionPoint & {
    status?: string;
    claim_id?: string | null; // <-- Añadido para acceso seguro
    claim?: {
      id?: string; // <-- Añadido para fallback
      status?: string;
      pickup_time?: string;
      recycler?: {
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
      const { data, error } = await supabase
        .from('collection_points')
        .select(`*,
          claim:collection_claims!claim_id (*, recycler:profiles!collection_claims_recycler_id_fkey (user_id, name, avatar_url, email, phone))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        console.log('[DEBUG] Resident Dashboard - fetched collection_points:', data); // DEBUG
        setDetailedPoints(data);
      }
      else setDetailedPoints([]);
    };
    fetchDetailedPoints();

    // --- SUSCRIPCIÓN EN TIEMPO REAL PARA ACTUALIZAR PUNTOS ---
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
        // Si el claim afecta a uno de los puntos de este usuario, refresca
        fetchDetailedPoints();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channelPoints);
    };
  }, [user]);

  // Filtrado por sub-tab
  const now = new Date();
  // Un punto está disponible si su status es 'available' y no tiene un claim activo
  const puntosTodos = detailedPoints.filter(p =>
    (p.status === 'available' || !p.status) && (!p.claim || p.claim.status !== 'claimed')
  );
  // Un punto está reclamado si su status es 'claimed', 'reclamado', o el claim está en 'claimed'
  const puntosReclamados = detailedPoints.filter(p =>
    p.status === 'claimed' || p.status === 'reclamado' || (p.claim && p.claim.status === 'claimed')
  );
  const puntosRetirados = detailedPoints.filter(p => p.status === 'completed' || (p.claim && p.claim.status === 'completed'));
  const puntosDemorados = detailedPoints.filter(p => {
    if ((p.status === 'claimed' || p.status === 'reclamado') && p.claim && p.claim.status === 'claimed' && p.claim.pickup_time) {
      const pickup = new Date(p.claim.pickup_time);
      return pickup < now;
    }
    return false;
  });

  // Estado para el modal de reciclador
  const [selectedRecycler, setSelectedRecycler] = useState<{
    name?: string;
    avatar_url?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  // --- Calificación de recicladores ---
const [showRatingModal, setShowRatingModal] = useState(false);
const [ratingTarget, setRatingTarget] = useState<{
  recyclerId: string,
  recyclerName: string,
  collectionClaimId: string
} | null>(null);
const [ratingValue, setRatingValue] = useState(0);
const [ratingComment, setRatingComment] = useState('');
const [ratingLoading, setRatingLoading] = useState(false);
const [ratingSuccess, setRatingSuccess] = useState<string|null>(null);
const [ratingError, setRatingError] = useState<string|null>(null);

// --- Donación Mercado Pago ---
const [showDonationModal, setShowDonationModal] = useState(false);
const [donationTarget, setDonationTarget] = useState<{ recyclerName: string; aliasOrCVU: string } | null>(null);
const [copySuccess, setCopySuccess] = useState(false);

const handleOpenDonation = (recycler: { name?: string; aliasOrCVU?: string } | null | undefined) => {
  if (!recycler) return;
  // Puedes cambiar 'aliasOrCVU' por el campo real que tengas en tu base de datos
  setDonationTarget({
    recyclerName: recycler.name || 'Reciclador',
    aliasOrCVU: recycler.aliasOrCVU || 'ALIAS.OFICIAL.MP', // Fallback si no hay alias
  });
  setShowDonationModal(true);
  setCopySuccess(false);
};

const handleCopyAlias = () => {
  if (donationTarget?.aliasOrCVU) {
    navigator.clipboard.writeText(donationTarget.aliasOrCVU);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1200);
  }
};

const handleSubmitRating = async () => {
  if (!user || !ratingTarget || ratingValue < 1) return;
  setRatingLoading(true);
  setRatingError(null);
  setRatingSuccess(null);
  try {
    // Insertar calificación en la tabla recycler_ratings
    const { error } = await supabase.from('recycler_ratings').insert({
      recycler_id: ratingTarget.recyclerId,
      resident_id: user.id,
      collection_claim_id: ratingTarget.collectionClaimId,
      rating: ratingValue,
      comment: ratingComment,
    });
    if (error) throw error;
    // Notificación para el reciclador
    await createNotification({
      user_id: ratingTarget.recyclerId,
      title: 'Nueva calificación',
      content: `Has recibido una nueva calificación de un residente.`,
      type: 'recycler_rated',
      user_name: ratingTarget.recyclerName
    });
    setRatingSuccess('¡Calificación enviada correctamente!');
    setRatingValue(0);
    setRatingComment('');
    setTimeout(() => {
      setShowRatingModal(false);
      setRatingSuccess(null);
    }, 1200);
  } catch {
    setRatingError('Error al enviar la calificación.');
  } finally {
    setRatingLoading(false);
  }
};

  // --- Estado para modal de ratings de reciclador ---
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratingsModalTarget, setRatingsModalTarget] = useState<{ recyclerId: string; recyclerName: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    // Refresca puntos si se navega con el flag refresh (tras crear un punto)
    if (location.state && location.state.refresh) {
      refreshCollectionPoints();
      // Limpia el state para evitar refrescos innecesarios al navegar de nuevo
      window.history.replaceState({}, document.title);
    }
  }, [location.state, refreshCollectionPoints]);

  const getAvatarUrl = (url: string | undefined) =>
  url ? url.replace('/object/avatars/', '/object/public/avatars/') : undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-2">
      {/* Mostrar mensaje de error si existe */}
      {error && (
        <div className="mb-4 w-full max-w-2xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {/* Mostrar mensaje de éxito si existe */}
      {success && (
        <div className="mb-4 w-full max-w-2xl bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{success}</span>
        </div>
      )}
      {/* Header con nombre, foto y rol */}
      <div className="w-full flex items-center justify-between bg-white shadow rounded-t-lg px-4 py-2 mb-4">
        <h2 className="text-xl font-bold text-green-700">Panel de Residente</h2>
        <NotificationBell />
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
          Mis Puntos de Recolección
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 relative
            ${activeTab === 'recicladores'
              ? 'bg-green-600 text-white shadow-lg scale-105 active-tab-effect'
              : 'bg-gray-200 text-gray-700 hover:bg-green-100'}
          `}
          onClick={() => {
            setActiveTab('recicladores');
            fetchRecyclers(); // Refresca la lista al hacer click
          }}
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
            <button onClick={() => setActivePointsTab('todos')} className={`px-3 py-1 rounded ${activePointsTab==='todos'?'bg-green-600 text-white':'bg-gray-100 text-gray-700'}`}>Todos</button>
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
                    // Determinar si el punto debe verse apagado
                    let isInactive = false;
                    if (activePointsTab === 'todos') {
                      isInactive = point.status === 'completed' || !!(point.claim && point.claim.status === 'completed');
                    } else if (activePointsTab === 'reclamados' || activePointsTab === 'demorados') {
                      isInactive = false; // Ahora los puntos reclamados y demorados están activos
                    } // En 'retirados' nunca se apaga
                    function getStatusLabel(status: string): React.ReactNode {
                      switch (status) {
                        case 'available':
                          return 'Disponible';
                        case 'claimed':
                        case 'reclamado':
                          return 'Reclamado';
                        case 'completed':
                          return 'Retirado';
                        case 'demorado':
                          return 'Demorado';
                        default:
                          return status;
                      }
                    }




                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    function handleMakeAvailableAgain(_point: CollectionPoint & {
                        status?: string; claim_id?: string | null; // <-- Añadido para acceso seguro
                        // <-- Añadido para acceso seguro
                        claim?: {
                          id?: string; // <-- Añadido para fallback
                          status?: string;
                          pickup_time?: string;
                          recycler?: {
                            user_id?: string;
                            name?: string;
                            avatar_url?: string;
                            email?: string;
                            phone?: string;
                          };
                        };
                      }): void {
                      throw new Error('Function not implemented.');
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
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">{getStatusLabel('available')}</span>
                            )}
                            {(point.status === 'claimed' || point.status === 'reclamado') && point.claim && point.claim.status === 'claimed' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">{getStatusLabel('claimed')}</span>
                            )}
                            {point.status === 'completed' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">{getStatusLabel('completed')}</span>
                            )}
                            {activePointsTab==='demorados' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold">{getStatusLabel('demorado')}</span>
                            )}
                          </div>
                          <p className="text-gray-500"><MapPin className="inline-block w-4 h-4 mr-1" />{point.district}</p>
                          <p className="text-gray-500"><Calendar className="inline-block w-4 h-4 mr-1" />{point.schedule}</p>
                          {/* Mostrar notas adicionales si existen */}
                          {point.notas && (<p className="text-gray-600 mt-2 text-sm"><b>Notas adicionales:</b> {point.notas}</p>)}
                          {point.additional_info && (<p className="text-gray-600 mt-2 text-sm"><b>Información adicional:</b> {point.additional_info}</p>)}
                          {/* Info del reciclador reclamante */}
                          {point.claim && point.claim.recycler && (
                            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 shadow-sm">
                              <UserIcon className="w-5 h-5 text-blue-700" />
                              <span className="font-semibold text-blue-900 text-base">
                                Reclamado por:
                                <button
                                  type="button"
                                  className="ml-1 underline font-bold text-blue-800 hover:text-blue-600 focus:outline-none transition-colors duration-150"
                                  onClick={() => setSelectedRecycler(point.claim?.recycler || null)}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                >
                                  {point.claim.recycler.name}
                                </button>
                              </span>
                              {point.claim.recycler.phone && <span className="ml-3 text-blue-700 text-sm font-medium">Tel: {point.claim.recycler.phone}</span>}
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
                        <div className="flex-shrink-0 md:ml-4 mt-4 md:mt-0 flex items-center">
                          <button
                            onClick={(e) => {
                              const btn = e.currentTarget;
                              const ripple = document.createElement('span');
                              ripple.className = 'ripple-effect';
                              const rect = btn.getBoundingClientRect();
                              ripple.style.left = `${e.clientX - rect.left}px`;
                              ripple.style.top = `${e.clientY - rect.top}px`;
                              btn.appendChild(ripple);
                              setTimeout(() => ripple.remove(), 600);
                              handleDelete(point.id);
                            }}
                            className={`bg-red-500 text-white rounded-lg px-4 py-2 flex items-center overflow-hidden relative ripple-btn ${isInactive ? 'opacity-50 pointer-events-none' : ''}`}
                            disabled={isDeleting || isInactive}
                          >
                            {isDeleting ? <Clock className="animate-spin h-5 w-5 mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}Eliminar
                          </button>
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
                            <button
                              className="mt-2 px-4 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500 shadow-md"
                              onClick={() => {
                                // Usar el UUID real del reciclador y del claim
                                const recyclerId = point.claim?.recycler?.user_id || '';
                                const recyclerName = point.claim?.recycler?.name || 'Reciclador';
                                const collectionClaimId = point.claim_id || point.claim?.id || '';
                                setRatingTarget({ recyclerId, recyclerName, collectionClaimId });
                                setShowRatingModal(true);
                              }}
                            >
                              Calificar reciclador
                            </button>
                            {/* Donar botón Mercado Pago */}
                            <button
                              className="mt-2 ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md"
                              onClick={() => handleOpenDonation(point.claim?.recycler)}
                              type="button"
                            >
                              Donar
                            </button>
                          </>
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
                  isRecycler: true
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
          {loadingRecyclers ? (
            <p className="text-gray-500 text-center">Cargando recicladores...</p>
          ) : recyclers.length === 0 ? (
            <p className="text-gray-500 text-center">No hay recicladores registrados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recyclers.map((rec) => (
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
                    {rec.online && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold animate-pulse ml-2">
                        <span className="w-2 h-2 bg-white rounded-full mr-1"></span>En línea
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center mb-1">
                    <Star className="h-5 w-5 text-yellow-400 mr-1" />
                    <span className="font-medium">{rec.rating_average?.toFixed(1) || '0.0'}</span>
                    <span className="ml-2 text-gray-400 text-sm">({rec.total_ratings || 0})</span>
                    <button
                      className="ml-3 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 border border-yellow-200"
                      onClick={() => {
                        setRatingsModalTarget({
                          recyclerId: rec.user_id || '',
                          recyclerName: rec.profiles?.name || 'Reciclador',
                          avatarUrl: rec.profiles?.avatar_url,
                        });
                        setShowRatingsModal(true);
                      }}
                    >
                      Ver comentarios
                    </button>
                  </div>
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
      )}
      {activeTab === 'perfil' && (
        <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6 flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4">Mi Perfil</h2>
          <form
            className="flex flex-col items-center w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              // Limpia y valida campos antes de enviar
              const updateObj: Record<string, unknown> = {};
              if (editName && editName.trim()) updateObj.name = editName.trim();
              if (editEmail && editEmail.trim()) updateObj.email = editEmail.trim();
              if (editPhone && editPhone.trim()) updateObj.phone = editPhone.trim();
              if (editAddress && editAddress.trim()) updateObj.address = editAddress.trim();
              if (editBio && editBio.trim()) updateObj.bio = editBio.trim();
              if (editMaterials && editMaterials.trim()) {
                updateObj.materials = editMaterials.split(',').map((m: string) => m.trim()).filter(Boolean);
              }
              // No permitimos editar lat/lng manualmente, pero los mostramos
              if (Object.keys(updateObj).length === 0) {
                setError('No hay cambios para actualizar');
                return;
              }
              const { error } = await supabase.from('profiles').update(updateObj).eq('user_id', user?.id);
              if (!error) {
                setSuccess('Perfil actualizado correctamente');
              } else {
                setError('Error al actualizar el perfil');
              }
            }}
          >
            <div className="w-24 h-24 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
              <img src={user?.avatar_url || avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
            </div>
            <PhotoCapture
              onCapture={file => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG, GIF o WEBP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no debe superar los 10MB.');
      return;
    }
                handlePhotoUpload(file);
              }}
              onCancel={() => {}}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-4">
              <div className="text-left">
                <label className="text-gray-600 text-sm">Nombre completo</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="text-left">
                <label className="text-gray-600 text-sm">Email</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div className="text-left">
                <label className="text-gray-600 text-sm">Teléfono</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              </div>
              <div className="text-left">
                <label className="text-gray-600 text-sm">Domicilio</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
              </div>
              <div className="text-left md:col-span-2">
                <label className="text-gray-600 text-sm">Biografía / Nota</label>
                <textarea className="font-semibold w-full border rounded px-2 py-1" value={editBio} onChange={e => setEditBio(e.target.value)} />
              </div>
              <div className="text-left md:col-span-2">
                <label className="text-gray-600 text-sm">Materiales (separados por coma)</label>
                <input
                  className="font-semibold w-full border rounded px-2 py-1"
                  value={editMaterials}
                  onChange={e => setEditMaterials(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Actualizar Perfil</button>
          </form>
        </div>
      )}
      {activeTab === 'historial' && (
        <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Historial de Actividades</h2>
          <p className="text-gray-500">Aquí puedes ver el historial de tus actividades relacionadas con el reciclaje.</p>
          {/* Aquí puedes agregar el contenido del historial */}
        </div>
      )}
      {/* {selectedRecycler && (
        <ChatWithRecycler
          otherUserId={selectedRecycler.id.toString()}
          otherUserName={selectedRecycler.name}
          open={!!selectedRecycler}
          onClose={() => setSelectedRecycler(null)}
        />
      )} */}
      {/* Modal de confirmación para eliminar cuenta */}
      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-bold mb-2 text-red-600">¿Eliminar cuenta?</h2>
            <p className="mb-4">Esta acción es irreversible. ¿Seguro que deseas eliminar tu cuenta?</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200"
                onClick={() => setShowDeleteAccount(false)}
                disabled={deletingAccount}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de información del reciclador */}
      {selectedRecycler && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-xs w-full flex flex-col items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
              {selectedRecycler.avatar_url && (
                <img src={selectedRecycler.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
              )}
            </div>
            <h3 className="text-xl font-bold text-green-700 mb-2">{selectedRecycler.name}</h3>
            {selectedRecycler.email && <p className="text-gray-600 text-sm mb-1">{selectedRecycler.email}</p>}
            {selectedRecycler.phone && <p className="text-gray-600 text-sm mb-1">{selectedRecycler.phone}</p>}
            <button
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => setSelectedRecycler(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {/* --- Modal de calificación de reciclador --- */}
      {showRatingModal && ratingTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full flex flex-col items-center">
            <h2 className="text-lg font-bold mb-2 text-green-700">Calificar a {ratingTarget.recyclerName}</h2>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 mb-3"
              rows={3}
              placeholder="Comentario (opcional)"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
            />
            <button
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={handleSubmitRating}
              disabled={ratingLoading}
            >
              {ratingLoading ? 'Enviando...' : 'Enviar Calificación'}
            </button>
            {ratingError && <div className="text-red-600 text-sm mt-2">{ratingError}</div>}
            {ratingSuccess && <div className="text-green-600 text-sm mt-2">{ratingSuccess}</div>}
            <button
              className="mt-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              onClick={() => setShowRatingModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {/* --- Modal de donación Mercado Pago --- */}
      {showDonationModal && donationTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full flex flex-col items-center">
            <h2 className="text-lg font-bold mb-2 text-blue-700">Donar a {donationTarget.recyclerName}</h2>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono bg-gray-100 px-2 py-1 rounded text-blue-800 border border-blue-200">{donationTarget.aliasOrCVU}</span>
              <button
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                onClick={handleCopyAlias}
              >
                Copiar
              </button>
              {copySuccess && <span className="text-green-600 text-xs ml-2">¡Copiado!</span>}
            </div>
            <button
              className="mt-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              onClick={() => setShowDonationModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {user?.role === 'admin' && <AdminNotifications />}
    </div>
  );
};

// --- FUNCION PARA VOLVER PUNTO A DISPONIBLE ---

export default DashboardResident;
<style>{`
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1, transform: translateY(0); }
}
.animate-fade-in { animation: fadeInUp 0.7s; }
.ripple-btn .ripple-effect {
  position: absolute;
  border-radius: 50%;
  transform: scale(0);
  animation: ripple 0.6s linear;
  background-color: rgba(255,255,255,0.7);
  pointer-events: none;
  width: 120px;
  height: 120px;
  opacity: 0.7;
  z-index: 10;
}
@keyframes ripple {
  to {
    transform: scale(2.5);
    opacity: 0;
  }
}
.active-tab-effect::after {
  content: '';
  display: block;
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: -6px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, #22c55e 60%, #bbf7d0 100%);
  opacity: 0.8;
  animation: tab-underline 0.3s;
}
@keyframes tab-underline {
  from { width: 0; opacity: 0; }
  to { width: 80%; opacity: 0.8; }
}
`}</style>
 
async function uploadProfilePhoto(file: File, user: User | null | undefined) {
  if (!user?.id) throw new Error('Usuario no autenticado');
  // 1. Subir la imagen a Supabase Storage (sin subcarpeta)
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}_${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });
  if (uploadError) throw new Error('Error al subir la imagen');
  // 2. Obtener la URL pública
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  const publicUrl = data.publicUrl;
  if (!publicUrl) throw new Error('No se pudo obtener la URL de la imagen');
  // 3. Actualizar el perfil del usuario
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('user_id', user.id);
  if (updateError) throw new Error('No se pudo actualizar el perfil con la foto');
}

