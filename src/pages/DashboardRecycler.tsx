import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Phone, Mail, MapIcon, X, User, Clock } from 'lucide-react';
import { supabase, type CollectionPoint, cancelClaim, claimCollectionPoint, completeCollection } from '../lib/supabase';
import Map from '../components/Map';
import CountdownTimer from '../components/CountdownTimer';
import { useUser } from '../context/UserContext';
import HeaderRecycler from '../components/HeaderRecycler';
import { Link } from 'react-router-dom';

const DashboardRecycler: React.FC = () => {
  const { user, login } = useUser();
  // const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<CollectionPoint | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showCancelClaimModal, setShowCancelClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<{ id: string; pointId: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [activeTab, setActiveTab] = useState('mis-puntos-disponibles');
  // Estado para el modal de programar recolección
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pointToClaim, setPointToClaim] = useState<CollectionPoint | null>(null);
  const [pickupDateTimeInput, setPickupDateTimeInput] = useState('');
  // Estado para edición de perfil
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editMaterials, setEditMaterials] = useState(user?.materials?.join(', ') || '');
  const [success, setSuccess] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  const [claimedPoints, setClaimedPoints] = useState<CollectionPoint[]>([]);
  const [availablePoints, setAvailablePoints] = useState<CollectionPoint[]>([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pointToComplete, setPointToComplete] = useState<CollectionPoint | null>(null);

  // NOTIFICACIONES DE MENSAJES NUEVOS
  const [unreadChats, setUnreadChats] = useState<{ [userId: string]: number }>({});

  // Cargar puntos reclamados y disponibles
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!user) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      // Reclamos del reciclador
      const { data: claimsData, error: claimsError } = await supabase
        .from('collection_claims')
        .select(`
          *,
          collection_point:collection_points!collection_claims_collection_point_id_fkey (
            *,
            profiles!collection_points_user_id_fkey (
              name,
              email,
              phone,
              avatar_url
            )
          )
        `)
        .eq('recycler_id', user.id)
        .order('claimed_at', { ascending: false });
      if (claimsError) throw claimsError;
      const claimed = claimsData.map(claim => ({
        ...claim.collection_point,
        claim_id: claim.id,
        status: claim.status,
        creator_name: claim.collection_point?.profiles?.name || 'Usuario Anónimo',
        creator_email: claim.collection_point?.profiles?.email,
        creator_phone: claim.collection_point?.profiles?.phone,
        creator_avatar: claim.collection_point?.profiles?.avatar_url,
        pickup_time: claim.pickup_time
      }));

      // Puntos disponibles
      const { data: availableData, error: availableError } = await supabase
        .from('collection_points')
        .select(`*, profiles!collection_points_user_id_fkey (name, email, phone, avatar_url)`)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (availableError) throw availableError;
      const available = availableData.map(point => ({
        ...point,
        creator_name: point.profiles?.name,
        creator_email: point.profiles?.email,
        creator_phone: point.profiles?.phone,
        creator_avatar: point.profiles?.avatar_url,
      }));

      setClaimedPoints(claimed);
      setAvailablePoints(available);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError('Error al cargar los datos');
    } finally {
    setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Abrir modal para programar recolección
  const handleOpenPickupModal = (point: CollectionPoint) => {
    setPointToClaim(point);
    setPickupDateTimeInput(''); // Resetear input
    setShowPickupModal(true);
    setError(null); // Limpiar errores previos
  };

  // Confirmar reclamo con hora de recolección
  const handleConfirmClaim = async () => {
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

    try {
      setError(null);
      setLoading(true);
      console.log('User object:', user);
      console.log('User ID being sent as recyclerId:', user.id); // Verifica este valor
      await claimCollectionPoint(pointToClaim!.id, user.id, new Date(pickupDateTimeInput).toISOString());
      await fetchData();
      setShowPickupModal(false);
      setPointToClaim(null);
      // Podrías añadir un mensaje de éxito aquí si lo deseas
    } catch (err: unknown) {
      let message = 'Error desconocido al reclamar el punto';
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
        message = (err as { message: string }).message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message || 'Error al reclamar el punto');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar reclamo
  const handleCancelClaim = async () => {
    if (!selectedClaim || !user) return;
    try {
      setError(null);
      await cancelClaim(selectedClaim.id, selectedClaim.pointId, user.id, cancellationReason);
      setShowCancelClaimModal(false);
      setSelectedClaim(null);
      setCancellationReason('');
      await fetchData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message || 'Error al cancelar la reclamación');
    }
  };

  // Marcar punto como retirado
  const handleCompleteCollection = async () => {
    if (!pointToComplete || !pointToComplete.claim_id) return;
    setLoading(true);
    setError(null);
    try {
      await completeCollection(pointToComplete.claim_id, pointToComplete.id);
      setShowCompleteModal(false);
      setPointToComplete(null);
      await fetchData();
    } catch (err: unknown) {
      let message = 'Error al marcar como retirado';
      if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // --- PRESENCIA EN TIEMPO REAL ---
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('recycler-presence')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (
            payload.new &&
            typeof payload.new.online === 'boolean' &&
            payload.new.online !== user.online // Solo si cambia el estado online
          ) {
            login({ ...user, online: payload.new.online });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, login]);

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

  // Sincronizar campos de edición de perfil con el usuario actual
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditEmail(user.email || '');
      setEditPhone(user.phone || '');
      setEditAddress(user.address || '');
      setEditBio(user.bio || '');
      setEditMaterials(Array.isArray(user.materials) ? user.materials.join(', ') : (user.materials || ''));
      setEditAvatarPreview(null);
      setEditAvatarFile(null);
    }
  }, [user]);

  // Escucha en tiempo real los mensajes recibidos
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('dashboard-messages-unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        const msg = payload.new;
        if (msg && msg.sender_id) {
          setUnreadChats(prev => ({
            ...prev,
            [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
          }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Cuando se abre el chat con un usuario, limpiar el contador
  const handleOpenChat = (userId: string) => {
    setUnreadChats(prev => ({ ...prev, [userId]: 0 }));
  };

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

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Enlace a puntos de recolección */}
        <div className="mb-6 flex justify-end">
          <Link
            to="/collection-points"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition font-semibold"
          >
            Ver todos los puntos de recolección
          </Link>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header profesional del reciclador */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-8 py-8 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100">
            <div className="flex-shrink-0">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-green-400 bg-white shadow">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-gray-300 mx-auto my-6" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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
                <span className="inline-block px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-semibold tracking-wide">Reciclador</span>
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
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span>{user.address}</span>
                  </div>
                )}
              </div>
              {user?.bio && (
                <div className="mt-3 text-gray-600 text-sm italic max-w-2xl">{user.bio}</div>
              )}
              <div className="flex gap-4 mt-4">
                {/* ...otros botones... */}
              </div>
            </div>
          </div>
          {/* Header con tabs y submenus */}
          <HeaderRecycler activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {/* Secciones de Mis Puntos */}
            {activeTab === 'mis-puntos-disponibles' && (
              <>
                <h2 className="text-xl font-semibold text-green-700 mb-4">Puntos Disponibles para Reclamar</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {availablePoints.length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No hay puntos disponibles para reclamar en este momento.</div>
                  )}
                  {availablePoints.map(point => (
                    <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-green-400">
                      <div className="p-6">
                        {/* Info principal */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <MapPin className="h-6 w-6 text-green-500" />
                            <div>
                              <h3 className="text-lg font-bold text-green-800">{point.address}</h3>
                              <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {point.materials.map((material: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>{point.schedule}</span>
                        </div>
                        {/* Botón reclamar */}
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleOpenPickupModal(point)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow"
                          >
                            Reclamar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPoint(point);
                              setShowMap(true);
                            }}
                            className="px-4 py-2 bg-gray-100 text-green-700 rounded hover:bg-gray-200 font-semibold border border-green-400"
                          >
                            Ver en Mapa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <hr className="my-10 border-green-300" />
              </>
            )}
            {activeTab === 'mis-puntos-reclamados' && (
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Reclamados</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {claimedPoints.filter(p => p.status === 'pending').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No tienes puntos reclamados.</div>
                  )}
                  {claimedPoints.filter(p => p.status === 'pending').map(point => (
                    <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="p-6">
                        {/* Info principal */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <MapPin className="h-6 w-6 text-green-500" />
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{point.address}</h3>
                              <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Reclamado</span>
                            {/* Botón Google Maps navegación usando coordenadas Mapbox */}
                            {typeof point.longitude === 'number' && typeof point.latitude === 'number' && typeof user?.lng === 'number' && typeof user?.lat === 'number' && (
                              <button
                                onClick={() => {
                                  const url = `https://www.google.com/maps/dir/?api=1&origin=${user.lat},${user.lng}&destination=${point.latitude},${point.longitude}&travelmode=driving`;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                title="Ver ruta en Google Maps"
                                className="inline-flex items-center px-2 py-1 rounded bg-white hover:bg-green-50 border border-green-200 shadow ml-2 transition focus:outline-none focus:ring-2 focus:ring-green-400"
                                style={{ minWidth: 0 }}
                              >
                                <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748481430/google-maps-icon_bur7my.png" alt="Google Maps" className="h-6 w-6 mr-1" />
                                <span className="hidden md:inline text-xs font-semibold text-green-700">Ruta</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {point.materials && Array.isArray(point.materials) && point.materials.map((material: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>{point.schedule}</span>
                        </div>
                        {point.pickup_time && (
                          <div className="mt-2 text-xs text-gray-500">Retiro programado: {new Date(point.pickup_time).toLocaleString()}</div>
                        )}
                        {point.status === 'pending' && point.pickup_time && (
                          <CountdownTimer targetDate={new Date(point.pickup_time)} onComplete={() => fetchData()} />
                        )}
                        {/* Info residente */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Residente:</h4>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-500">
                              <User className="h-4 w-4 mr-2" />
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
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <button
                              onClick={() => {
                                setSelectedPoint(point);
                                setShowMap(true);
                              }}
                              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                            >
                              <MapIcon className="h-4 w-4 mr-2" />
                              Ver en Mapa
                            </button>
                            <button
                              onClick={() => {
                                setSelectedClaim({ id: point.claim_id!, pointId: point.id });
                                setShowCancelClaimModal(true);
                              }}
                              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancelar Reclamo
                            </button>
                            <button
                              onClick={() => {
                                setPointToComplete(point);
                                setShowCompleteModal(true);
                              }}
                              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Retirado
                            </button>
                            {/* Enlace robusto al chat con residente */}
                            {point.user_id ? (
                              <Link
                                to={`/chat/${point.user_id}`}
                                onClick={() => handleOpenChat(point.user_id)}
                                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 col-span-3 md:col-span-1 mt-2 md:mt-0 relative"
                              >
                                💬 Chat con residente
                                {unreadChats[point.user_id] > 0 && (
                                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-2 py-0.5 font-bold animate-bounce shadow">{unreadChats[point.user_id]}</span>
                                )}
                              </Link>
                            ) : (
                              <span className="flex items-center justify-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-100 col-span-3 md:col-span-1 mt-2 md:mt-0 cursor-not-allowed">
                                No disponible para chat
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeTab === 'mis-puntos-cancelados' && (
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Cancelados</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {claimedPoints.filter(p => p.status === 'cancelled').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No tienes puntos cancelados.</div>
                  )}
                  {claimedPoints.filter(p => p.status === 'cancelled').map(point => (
                    <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <MapPin className="h-6 w-6 text-green-500" />
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{point.address}</h3>
                              <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Cancelado</span>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {point.materials.map((material: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                            ))}
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
                              <User className="h-4 w-4 mr-2" />
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
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeTab === 'mis-puntos-retirados' && (
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Retirados</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {claimedPoints.filter(p => p.status === 'completed').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No tienes puntos retirados.</div>
                  )}
                  {claimedPoints.filter(p => p.status === 'completed').map(point => (
                    <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <MapPin className="h-6 w-6 text-green-500" />
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{point.address}</h3>
                              <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Retirado</span>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {point.materials.map((material: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>{point.schedule}</span>
                        </div>
                        {point.completed_at && (
                          <div className="mt-2 text-xs text-gray-500">Retirado el: {new Date(point.completed_at).toLocaleString()}</div>
                        )}
                        {/* Botón favorito (placeholder) */}
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold hover:bg-yellow-200"
                            // onClick={() => handleToggleFavorite(point.id)}
                            disabled
                          >
                            ★ Marcar como favorito
                          </button>
                          {/* Si ya es favorito, mostrar opción para quitar */}
                          {/* <button ...>Quitar de favoritos</button> */}
                        </div>
                        {/* Info residente */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Residente:</h4>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-500">
                              <User className="h-4 w-4 mr-2" />
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
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeTab === 'perfil' && (
              <div className="max-w-xl mx-auto bg-white rounded-lg shadow-md p-6 mt-4">
                <h2 className="text-2xl font-bold mb-4 text-green-700">Mi Perfil</h2>
                <form
                  className="flex flex-col items-center gap-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    let avatarUrl = user?.avatar_url || null;
                    if (editAvatarFile) {
                      const fileExt = editAvatarFile.name.split('.').pop();
                      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
                      const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(fileName, editAvatarFile, { upsert: true });
                      if (uploadError) {
                        setError('Error al subir la imagen de perfil');
                        return;
                      }
                      avatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
                    }
                    const formMaterials = editMaterials.split(',').map((m) => m.trim()).filter(Boolean);
                    const { error: updateError } = await supabase.from('profiles').update({
                      name: editName,
                      email: editEmail,
                      phone: editPhone,
                      address: editAddress,
                      bio: editBio,
                      materials: formMaterials,
                      avatar_url: avatarUrl,
                    }).eq('user_id', user.id);
                    if (!updateError) {
                      // Obtener el perfil actualizado
                      const { data: updatedProfile, error: fetchError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();
                      if (!fetchError && updatedProfile) {
                        // Normalización defensiva para evitar errores de renderizado
                        const safeMaterials = Array.isArray(updatedProfile.materials)
                          ? updatedProfile.materials
                          : (typeof updatedProfile.materials === 'string' && updatedProfile.materials.length > 0
                              ? [updatedProfile.materials]
                              : []);
                        const safeBio = typeof updatedProfile.bio === 'string' ? updatedProfile.bio : '';
                        login({
                          ...user,
                          ...updatedProfile,
                          type: updatedProfile.role || user.type,
                          materials: safeMaterials,
                          bio: safeBio,
                        });
                        setEditName(updatedProfile.name || '');
                        setEditEmail(updatedProfile.email || '');
                        setEditPhone(updatedProfile.phone || '');
                        setEditAddress(updatedProfile.address || '');
                        setEditBio(safeBio);
                        setEditMaterials(safeMaterials.join(', '));
                        setEditAvatarPreview(null);
                        setEditAvatarFile(null);
                      }
                      setSuccess('Perfil actualizado correctamente');
                    } else {
                      setError('Error al actualizar el perfil');
                    }
                  }}
                >
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-green-600 flex items-center justify-center mb-2">
                    {editAvatarPreview ? (
                      <img src={editAvatarPreview || undefined} alt="Preview" className="w-full h-full object-cover" />
                    ) : user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="mb-2"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setEditAvatarFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setEditAvatarPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setEditAvatarPreview(null);
                      }
                    }}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div>
                      <label className="text-gray-600 text-sm">Nombre completo</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-gray-600 text-sm">Email</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-gray-600 text-sm">Teléfono</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-gray-600 text-sm">Domicilio</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-gray-600 text-sm">Biografía / Nota</label>
                      <textarea className="font-semibold w-full border rounded px-2 py-1" value={editBio} onChange={e => setEditBio(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-gray-600 text-sm">Materiales (separados por coma)</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editMaterials} onChange={e => setEditMaterials(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Actualizar Perfil</button>
                  {success && <div className="text-green-600 mt-2">{success}</div>}
                  {error && <div className="text-red-600 mt-2">{error}</div>}
                </form>
              </div>
            )}
            {activeTab === 'historial' && (
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 mt-4">
                <h2 className="text-2xl font-bold mb-4 text-green-700">Historial</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-700">{claimedPoints.filter(p => p.status === 'pending').length}</div>
                    <div className="text-gray-600 mt-1">Reclamados</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-700">{claimedPoints.filter(p => p.status === 'cancelled').length}</div>
                    <div className="text-gray-600 mt-1">Cancelados</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">{claimedPoints.filter(p => p.status === 'completed').length}</div>
                    <div className="text-gray-600 mt-1">Retirados</div>
                  </div>
                </div>
                {/* Estadísticas adicionales (ejemplo: kilos recolectados por mes) */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Estadísticas</h3>
                  <div className="text-gray-700 text-sm">(Próximamente: kilos recolectados por mes, gráfica, etc.)</div>
                </div>
              </div>
            )}
            {activeTab === 'favoritos' && (
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 mt-4">
                <h2 className="text-2xl font-bold mb-4 text-yellow-600">Mis Puntos Favoritos</h2>
                <div className="text-gray-500 mb-4">Próximamente: aquí verás los puntos retirados que marcaste como favoritos.</div>
                {/* Aquí se mostrarán las tarjetas de puntos favoritos cuando se implemente la lógica */}
              </div>
            )}
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
                      points={[{
                        id: selectedPoint.id,
                        lat: Number(selectedPoint.latitude),
                        lng: Number(selectedPoint.longitude),
                        title: selectedPoint.address,
                        avatar_url: selectedPoint.creator_avatar
                      }]}
                      showUserLocation={true}
                      showRoute={true}
                      routeDestination={{ lat: Number(selectedPoint.latitude), lng: Number(selectedPoint.longitude) }}
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
                    <textarea
                      id="reason"
                      rows={4}
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="Explica por qué deseas cancelar esta reclamación..."
                      required
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardRecycler;









