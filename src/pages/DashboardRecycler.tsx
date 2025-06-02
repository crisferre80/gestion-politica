import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Phone, Mail, MapIcon, X, User, Clock } from 'lucide-react';
import { supabase, type CollectionPoint, cancelClaim, claimCollectionPoint, completeCollection } from '../lib/supabase';
import Map from '../components/Map';
import CountdownTimer from '../components/CountdownTimer';
import { useUser } from '../context/UserContext';
import NotificationBell from '../components/NotificationBell';
import HeaderRecycler from '../components/HeaderRecycler';

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
  const [focusedResidentUserId, setFocusedResidentUserId] = useState<string>();

  // NOTIFICACIONES DE MENSAJES NUEVOS

  // --- Notificaciones de eventos del residente ---
  const [eventNotifications, setEventNotifications] = useState<Array<{id: string, type: string, message: string, created_at: string}>>([]);

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
            profiles:profiles!collection_points_user_id_fkey (
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
      const claimed = (claimsData || []).map(claim => ({
        ...claim.collection_point,
        claim_id: claim.id,
        status: claim.status,
        creator_name: claim.collection_point?.profiles?.name || 'Usuario Anónimo',
        creator_email: claim.collection_point?.profiles?.email,
        creator_phone: claim.collection_point?.profiles?.phone,
        creator_avatar: claim.collection_point?.profiles?.avatar_url,
        pickup_time: claim.pickup_time
      }));

      // Puntos disponibles (step 1: fetch points)
      const { data: availableData, error: availableError } = await supabase
        .from('collection_points')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (availableError) throw availableError;
      const availablePointsRaw = availableData || [];
      console.log('Puntos disponibles crudos:', availablePointsRaw);
      // Step 2: get all unique user_ids
      const userIds = [...new Set(availablePointsRaw.map(p => p.user_id))];
      console.log('userIds únicos:', userIds);
      let profilesById: Record<string, Pick<import('../lib/supabase').User, 'name' | 'email' | 'phone' | 'avatar_url'>> = {};
      if (userIds.length > 0) {
        // Step 3: fetch all profiles for these user_ids
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, email, phone, avatar_url')
          .in('user_id', userIds);
        if (profilesError) throw profilesError;
        console.log('Perfiles obtenidos:', profilesData);
        profilesById = (profilesData || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {} as Record<string, Pick<import('../lib/supabase').User, 'name' | 'email' | 'phone' | 'avatar_url'>>);
      }
      // Step 4: merge profile info into points
      const available = availablePointsRaw.map(point => {
        const profile = profilesById[point.user_id];
        if (!profile) {
          console.warn('No se encontró perfil para user_id', point.user_id);
        }
        return {
          ...point,
          creator_name: profile?.name || 'Usuario Anónimo',
          creator_email: profile?.email,
          creator_phone: profile?.phone,
          creator_avatar: profile?.avatar_url,
          profiles: profile, // for phone in UI
        };
      });
      console.log('Puntos disponibles con perfil:', available);

      setClaimedPoints(claimed);
      setAvailablePoints(available);
    } catch (err) {
      // Mostrar el error real de Supabase si existe
      if (err && typeof err === 'object' && 'message' in err) {
        setError((err as { message: string }).message + '\n' + JSON.stringify(err));
      } else {
        setError('Error al cargar los datos: ' + JSON.stringify(err));
      }
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
      console.log('Point to claim:', pointToClaim);
      console.log('Pickup time:', pickupDateTimeInput);
      try {
        await claimCollectionPoint(
          pointToClaim!.id,
          user.id,
          new Date(pickupDateTimeInput).toISOString(),
          pointToClaim.user_id // <-- user_id del residente dueño del punto
        );
      } catch (err) {
        console.error('Error en claimCollectionPoint:', err);
        throw err;
      }
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
      await cancelClaim(selectedClaim.id, selectedClaim.pointId, cancellationReason);
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

  // Suscripción en tiempo real a collection_points para actualización instantánea de puntos
  useEffect(() => {
    if (!user?.id) return;
    // Solo recicladores activos
    const channel = supabase.channel('recycler-collection-points')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_points',
      }, (payload) => {
        // Si el punto es nuevo, cambia de estado, o es eliminado, refresca los datos
        if (
          payload.eventType === 'INSERT' ||
          (payload.eventType === 'UPDATE' && (payload.new.status === 'available' || payload.old.status === 'available')) ||
          payload.eventType === 'DELETE'
        ) {
          fetchData();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const getAvatarUrl = (url: string | undefined) =>
    url ? url.replace('/object/avatars/', '/object/public/avatars/') : undefined;

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
  const trulyAvailablePoints = availablePoints.filter(p => !claimedIds.has(p.id));

  // Helper: get resident user_id from a point (typed)
  const getResidentUserIdFromPoint = (point: CollectionPoint) => point.user_id;

  // Handler para cambio de vista que limpia el residente enfocado
  const handleSetView = (newView: string) => {
    setViewState(newView);
    setFocusedResidentUserId(undefined);
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <HeaderRecycler
        activeTab={view}
        setActiveTab={handleSetView}
        residentUserId={focusedResidentUserId}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
                {user?.avatar_url ? (
                  <img src={getAvatarUrl(user.avatar_url)} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-gray-300 mx-auto my-6" />
                )}
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
          <div className="p-6">
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
            {/* Dropdown for view selection */}
            <div className="mb-6 flex justify-end">
              <select
                className="border border-green-300 rounded px-3 py-2 text-green-800 bg-white shadow focus:outline-none focus:ring-2 focus:ring-green-400"
                value={view}
                onChange={e => handleSetView(e.target.value)}
              >
                <option value="disponibles">Puntos Disponibles</option>
                <option value="reclamados">Puntos Reclamados</option>
                <option value="cancelados">Puntos Cancelados</option>
                <option value="retirados">Puntos Retirados</option>
              </select>
            </div>

            {/* Secciones de Mis Puntos */}
            <div>
              {view === 'disponibles' && (
                <div>
                  <h2 className="text-xl font-semibold text-green-700 mb-4">Puntos Disponibles para Reclamar</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {trulyAvailablePoints.length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">
                        No hay puntos disponibles para reclamar en este momento.<br />
                        <span className="text-xs text-red-500">Debug: {JSON.stringify(availablePoints)}</span>
                      </div>
                    ) : (
                      trulyAvailablePoints.map(point => (
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
                              <div className="flex items-center gap-2">
                                {/* Botón Google Maps navegación usando coordenadas Mapbox */}
                                {/* Eliminado el botón de la esquina, solo se deja el botón junto a 'Ver en Mapa' */}
                              </div>
                            </div>
                            <div className="flex flex-row items-start mt-4">
                              <div className="mr-6 flex-shrink-0">
                                <img
                                  src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png"
                                  alt="Reciclaje"
                                  className="w-36 h-36 object-contain animate-bounce-slow"
                                  style={{ filter: 'drop-shadow(0 4px 12px rgba(34,197,94,0.25))' }}
                                />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {point.materials.map((material: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
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
                                      { en: 'Monday', es: 'Lunes' },
                                      { en: 'Tuesday', es: 'Martes' },
                                      { en: 'Wednesday', es: 'Miércoles' },
                                      { en: 'Thursday', es: 'Jueves' },
                                      { en: 'Friday', es: 'Viernes' },
                                      { en: 'Saturday', es: 'Sábado' },
                                      { en: 'Sunday', es: 'Domingo' },
                                    ];
                                    let texto = point.schedule;
                                    dias.forEach(d => {
                                      texto = texto.replace(new RegExp(d.en, 'g'), d.es);
                                    });
                                    return texto.replace(/\b(AM|PM)\b/gi, m => m.toLowerCase());
                                  })()
                                : ''}</span>
                            </div>
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
                                <button
                                  onClick={() => {
                                    setSelectedPoint(point);
                                    setShowMap(true);
                                  }}
                                  className="px-4 py-2 bg-gray-100 text-green-700 rounded hover:bg-gray-200 font-semibold border border-green-400 flex items-center"
                                >
                                  <MapIcon className="h-4 w-4 mr-2" />
                                  Ver en Mapa
                                </button>
                                {/* Botón Google Maps justo al lado */}
                                {typeof point.lng === 'number' && typeof point.lat === 'number' && typeof user?.lng === 'number' && typeof user?.lat === 'number' ? (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      const latNum = Number(user.lat);
                                      const lngNum = Number(user.lng);
                                      const origin = (!isNaN(latNum) && !isNaN(lngNum) && Math.abs(latNum) > 0.01 && Math.abs(lngNum) > 0.01)
                                        ? `${latNum},${lngNum}`
                                        : 'current+location';
                                      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${point.lat},${point.lng}&travelmode=driving`;
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    }}
                                    title="Ver ruta en Google Maps"
                                    className="ml-2 p-0 bg-transparent border-none shadow-none focus:outline-none"
                                    style={{ minWidth: 0 }}
                                  >
                                    <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748481430/google-maps-icon_bur7my.png" alt="Google Maps" className="h-8 w-8 animate-bounce-map" />
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
                    {claimedPoints.filter(p => p.status === 'claimed').length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">No tienes puntos reclamados.</div>
                    ) : (
                      claimedPoints.filter(p => p.status === 'claimed').map(point => (
                        <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                          <div className="p-6">
                            {/* Info principal */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <MapPin className="h-8 w-8 text-green-500" />
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">{point.address}</h3>
                                  <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Reclamado</span>
                            </div>
                            <div className="flex flex-row justify-between items-start mt-4">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {point.materials && Array.isArray(point.materials) && point.materials.map((material: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{material}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                <img
                                  src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png"
                                  alt="Reciclaje"
                                  className="w-28 h-28 object-contain bg-white shadow-none"
                                />
                              </div>
                            </div>
                            <div className="mt-4">
                              {point.pickup_time && (
                                <div className="text-xs text-gray-500">Retiro programado: {new Date(point.pickup_time).toLocaleString()}</div>
                              )}
                              {point.status === 'claimed' && point.pickup_time && (
                                <CountdownTimer targetDate={new Date(point.pickup_time)} onComplete={() => fetchData()} />
                              )}
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
                            {/* Botones de acción */}
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedClaim({ id: point.claim_id ?? '', pointId: point.id ?? '' });
                                  setShowCancelClaimModal(true);
                                  setFocusedResidentUserId(getResidentUserIdFromPoint(point));
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold shadow"
                              >
                                Cancelar reclamo
                              </button>
                              <button
                                onClick={() => {
                                  setPointToComplete(point);
                                  setShowCompleteModal(true);
                                  setFocusedResidentUserId(getResidentUserIdFromPoint(point));
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow"
                              >
                                Marcar como retirado
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {view === 'cancelados' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Cancelados</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {claimedPoints.filter(p => p.status === 'cancelled').length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500">No tienes puntos cancelados.</div>
                    ) : (
                      claimedPoints.filter(p => p.status === 'cancelled').map(point => (
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
                                  src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png"
                                  alt="Reciclaje"
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
                      ))
                    )}
                  </div>
                </div>
              )}
              {view === 'retirados' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Retirados</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {claimedPoints.filter(p => p.status === 'completed').length === 0 && (
                      <div className="col-span-2 text-center text-gray-500">No tienes puntos retirados.</div>
                    )}
                    {claimedPoints.filter(p => p.status === 'completed').map(point => (
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Retirado</span>
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
                                src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1748621356/pngwing.com_30_y0imfa.png"
                                alt="Reciclaje"
                                className="w-28 h-28 object-contain bg-white shadow-none"
                              />
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
                      points={[{
                        id: selectedPoint.id,
                        lat: Number(selectedPoint.lat),
                        lng: Number(selectedPoint.lng),
                        title: selectedPoint.address,
                        avatar_url: selectedPoint.creator_avatar
                      }]}
                      showUserLocation={true}
                      showRoute={true}
                      routeDestination={{ lat: Number(selectedPoint.lat), lng: Number(selectedPoint.lng) }}
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









