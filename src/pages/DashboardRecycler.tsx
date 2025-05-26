import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Plus, Star, Phone, MapIcon, X, User, Camera, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase, type CollectionPoint, type RecyclerProfile, cancelClaim, deleteCollectionPoint, fetchRecyclerProfiles, claimCollectionPoint, uploadProfilePhoto } from '../lib/supabase';
import Map from '../components/Map';
import PhotoCapture from '../components/PhotoCapture';
import CountdownTimer from '../components/CountdownTimer';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const { user, login } = useUser();
  const [activeTab, setActiveTab] = useState<'points' | 'recyclers' | 'history' | 'profile' | 'messages'>('points');
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [recyclers, setRecyclers] = useState<RecyclerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<CollectionPoint | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pointToDelete, setPointToDelete] = useState<string | null>(null);
  const [showCancelClaimModal, setShowCancelClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<{ id: string; pointId: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    materials: '',
    bio: '',
    service_areas: '',
    experience_years: '',
  });
  const [locationError, setLocationError] = useState<string | null>(null);

  interface ConversationProfile {
    name?: string;
    email?: string;
    avatar_url?: string;
  }
  interface Conversation {
    user_id: string;
    profiles?: ConversationProfile;
  }
  interface ChatMessage {
    id: string;
    sender_id: string;
    receiver_id: string;
    text: string;
    created_at: string;
  }
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Cargar datos principales
  const fetchData = useCallback(async () => {
    console.log('[fetchData] called', { user });
    try {
      setLoading(true);
      setError(null);

      if (user?.type === 'resident') {
        const { data: pointsData, error: pointsError } = await supabase
          .from('collection_points')
          .select(`
            *,
            profiles!collection_points_user_id_fkey (
              name,
              email,
              phone,
              avatar_url
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        if (pointsError) throw pointsError;
        const recyclerProfiles = await fetchRecyclerProfiles();

        setCollectionPoints(pointsData.map(point => ({
          ...point,
          creator_name: point.profiles.name,
          creator_email: point.profiles.email,
          creator_phone: point.profiles.phone,
          creator_avatar: point.profiles.avatar_url
        })));
        setRecyclers(recyclerProfiles);

      } else if (user?.type === 'recycler') {
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

        const points = claimsData.map(claim => ({
          ...claim.collection_point,
          claim_id: claim.id,
          status: claim.status,
          claimed_at: claim.claimed_at,
          completed_at: claim.completed_at,
          cancelled_at: claim.cancelled_at,
          cancellation_reason: claim.cancellation_reason,
          created_at: claim.created_at,
          updated_at: claim.updated_at,
          cancelled_by: claim.cancelled_by,
          pickup_time: claim.pickup_time,
          estimated_weight: claim.estimated_weight,
          creator_name: claim.collection_point?.profiles?.name || 'Usuario Anónimo',
          creator_email: claim.collection_point?.profiles?.email,
          creator_phone: claim.collection_point?.profiles?.phone,
          creator_avatar: claim.collection_point?.profiles?.avatar_url,
        }));

        setCollectionPoints(points);
      }
    } catch (e) {
      console.error('[fetchData] error', e);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
      console.log('[fetchData] finished');
    }
  }, [user]);

  useEffect(() => {
    console.log('[useEffect] user or fetchData changed', { user });
    if (user) {
      fetchData();
      if (user.avatar_url) setProfilePhoto(user.avatar_url);
    }
  }, [user, fetchData]);

  useEffect(() => {
    console.log('[useEffect] user changed for profileData', { user });
    setProfileData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      materials:
        user?.type === 'recycler' && Array.isArray((user as unknown as RecyclerProfile).materials)
          ? (user as unknown as RecyclerProfile).materials.join(', ')
          : '',
      bio:
        user?.type === 'recycler' && typeof (user as unknown as RecyclerProfile).bio === 'string'
          ? (user as unknown as RecyclerProfile).bio ?? ''
          : '',
      service_areas:
        user?.type === 'recycler' && Array.isArray((user as unknown as RecyclerProfile).service_areas)
          ? (user as unknown as RecyclerProfile).service_areas.join(', ')
          : '',
      experience_years:
        user?.type === 'recycler' && typeof ((user as unknown as RecyclerProfile).experience_years) !== 'undefined'
          ? String((user as unknown as RecyclerProfile).experience_years)
          : '',
    });
  }, [user]);

  // Estado online y geolocalización automática
  useEffect(() => {
    console.log('[useEffect] geolocation effect', { user });
    let watchId: number | null = null;
    let isMounted = true;

    const updateLocation = async (latitude: number, longitude: number) => {
      try {
        if (!user) return;
        await supabase
          .from('profiles')
          .update({ lat: latitude, lng: longitude, online: true })
          .eq('id', user.id);
        if (isMounted) {
          setLocationError(null);
          // NO LLAMAR login({ ...user, lat, lng }) aquí para evitar loops infinitos
        }
      } catch (err) {
        if (isMounted) {
          setLocationError('Error actualizando tu ubicación.');
        }
        console.error('[geolocation] update error:', err);
      }
    };

    if (user && user.type === 'recycler') {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            updateLocation(latitude, longitude);
          },
          (error) => {
            if (isMounted) {
              setLocationError('No se pudo obtener tu ubicación en tiempo real. Activa la ubicación para aparecer en el mapa de residentes.');
            }
            console.error('[geolocation] error:', error);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );
      } else {
        setLocationError('Tu navegador no soporta geolocalización.');
      }
    }

    return () => {
      isMounted = false;
      console.log('[useEffect cleanup] geolocation effect', { user });
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      // Solo marcar offline si el usuario sigue siendo reciclador
      if (user && user.type === 'recycler') {
        supabase.from('profiles').update({ online: false }).eq('id', user.id);
      }
    };
  }, [user]);

  // Conversaciones y mensajes
  useEffect(() => {
    console.log('[useEffect] fetchConversations', { user, activeTab });
    if (user?.type !== 'recycler') return;
    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id, profiles:sender_id(name, email, avatar_url)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const unique = Object.values(
          data.reduce((acc: Record<string, Conversation>, msg) => {
            acc[msg.sender_id] = {
              user_id: msg.sender_id,
              profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles
            };
            return acc;
          }, {} as Record<string, Conversation>)
        );
        setConversations(unique);
      }
    };
    fetchConversations();
  }, [user, activeTab]);

  useEffect(() => {
    console.log('[useEffect] fetchMessages', { selectedConversation, user });
    if (!selectedConversation || !user?.id) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedConversation.user_id}),and(sender_id.eq.${selectedConversation.user_id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      if (!error && data) setChatMessages(data);
    };
    fetchMessages();
  }, [selectedConversation, user]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !user?.id || !selectedConversation) return;
    await supabase.from('messages').insert([
      {
        sender_id: user.id,
        receiver_id: selectedConversation.user_id,
        text: chatInput,
      },
    ]);
    setChatInput('');
  };

  // Suscripción en tiempo real para mensajes nuevos
  useEffect(() => {
    console.log('[useEffect] subscribe recycler-messages', { selectedConversation, user });
    if (!selectedConversation || !user?.id) return;
    const channel = supabase
      .channel('recycler-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(sender_id=eq.${user.id},receiver_id=eq.${user.id})`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (
            (msg.sender_id === user.id && msg.receiver_id === selectedConversation.user_id) ||
            (msg.sender_id === selectedConversation.user_id && msg.receiver_id === user.id)
          ) {
            setChatMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();
    return () => {
      console.log('[useEffect cleanup] unsubscribe recycler-messages');
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, user]);

  useEffect(() => {
    console.log('[useEffect] subscribe messages-realtime', { user });
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
          if (msg.receiver_id === user.id && msg.sender_id !== user.id) {
            toast.success('¡Nuevo mensaje recibido!');
          }
        }
      )
      .subscribe();
    return () => {
      console.log('[useEffect cleanup] unsubscribe messages-realtime');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Funciones de acciones
  const handleCancelClaim = async () => {
    if (!selectedClaim || !user) return;
    try {
      setError(null);
      await cancelClaim(selectedClaim.id, user.id, cancellationReason);
      setCollectionPoints(points => points.filter(p => p.id !== selectedClaim.pointId));
      setShowCancelClaimModal(false);
      setSelectedClaim(null);
      setCancellationReason('');
    } catch {
      setError('Error al cancelar la reclamación');
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    try {
      setError(null);
      await deleteCollectionPoint(pointId);
      setCollectionPoints(points => points.filter(p => p.id !== pointId));
      setShowDeleteConfirm(false);
      setPointToDelete(null);
    } catch {
      setError('Error al eliminar el punto de recolección');
    }
  };

  const handleClaimPoint = async (pointId: string) => {
    if (!user) return;
    try {
      setError(null);
      const pickupTime = new Date().toISOString();
      await claimCollectionPoint(pointId, user.id, pickupTime);
      setCollectionPoints(points =>
        points.map(p =>
          p.id === pointId ? { ...p, status: 'claimed' } : p
        )
      );
    } catch {
      setError('Error al reclamar el punto');
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setProfileData(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      setError(null);
      const { data: profileDataResult, error: profileError } = await supabase
        .from('profiles')
        .update({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          address: profileData.address,
        })
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (profileError) throw profileError;

      let recyclerDataResult = null;
      if (user.type === 'recycler') {
        const { data: recyclerData, error: recyclerError } = await supabase
          .from('recycler_profiles')
          .update({
            materials: profileData.materials.split(',').map(m => m.trim()),
            service_areas: profileData.service_areas.split(',').map(z => z.trim()),
            bio: profileData.bio,
            experience_years: Number(profileData.experience_years),
          })
          .eq('user_id', user.id)
          .select()
          .maybeSingle();
        if (recyclerError) throw recyclerError;
        recyclerDataResult = recyclerData;
      }

      setProfileData(prev => ({
        ...prev,
        ...profileDataResult,
        ...(user.type === 'recycler' && recyclerDataResult
          ? {
              materials: Array.isArray(recyclerDataResult.materials)
                ? recyclerDataResult.materials.join(', ')
                : '',
              bio: recyclerDataResult.bio || '',
            }
          : {}),
      }));
      login({
        ...user,
        name: profileDataResult.name,
        email: profileDataResult.email,
        phone: profileDataResult.phone,
        address: profileDataResult.address,
        ...(user.type === 'recycler' && recyclerDataResult
          ? {
              materials: recyclerDataResult.materials,
              bio: recyclerDataResult.bio,
            }
          : {}),
      });
    } catch {
      setError('Error al actualizar el perfil');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      if (!user) return;
      const publicUrl = await uploadProfilePhoto(user.id, file);
      setProfilePhoto(publicUrl);
      toast.success('Foto actualizada correctamente');
      login({
        ...user,
        avatar_url: publicUrl,
      });
    } catch {
      toast.error('Error al subir la foto');
    }
  };

  const handleVerRutaGoogleMaps = (point: CollectionPoint) => {
    // Usa los mismos campos que Mapbox: lat y lng
    const destLat = Number(point.lat ?? point.latitude);
    const destLng = Number(point.lng ?? point.longitude);

    if (!destLat || !destLng) {
      toast.error('No se pudo obtener la ubicación del punto.');
      return;
    }

    // Usa la ubicación del usuario si está disponible (como en Mapbox)
    if (user && typeof user.lat === 'number' && typeof user.lng === 'number') {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${user.lat},${user.lng}&destination=${destLat},${destLng}&travelmode=driving`;
      window.open(url, '_blank');
      return;
    }

    // Si no hay lat/lng en el usuario, pide la ubicación al navegador
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const originLat = position.coords.latitude;
          const originLng = position.coords.longitude;
          const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
          window.open(url, '_blank');
        },
        () => {
          toast.error('No se pudo obtener tu ubicación actual.');
        }
      );
    } else {
      toast.error('Tu navegador no soporta geolocalización.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Debes iniciar sesión para ver esta página</p>
          <Link to="/login" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
            Iniciar sesión
          </Link>
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

  const geoErrorBanner = locationError ? (
    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 mt-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-700">{locationError}</p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {showPhotoCapture && (
          <PhotoCapture
            onCapture={async (file: File) => {
              await handlePhotoUpload(file);
              setShowPhotoCapture(false);
            }}
            onCancel={() => setShowPhotoCapture(false)}
          />
        )}

        {showMap && selectedPoint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl mx-4">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium">{selectedPoint.address}</h3>
                <button 
                  onClick={() => setShowMap(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
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

        {/* Show cancel claim modal */}
        {showCancelClaimModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Cancelar Reclamación
              </h3>
              <div className="mb-4">
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de la cancelación
                </label>
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

        {/* Show delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">
                  Confirmar Eliminación
                </h3>
              </div>
              <p className="text-gray-500 mb-4">
                ¿Estás seguro de que deseas eliminar este punto de recolección? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setPointToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => pointToDelete && handleDeletePoint(pointToDelete)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Dashboard Header */}
          <div className="bg-green-600 text-white p-6">
            <div className="flex items-center">
              <div className="relative">
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt={user.name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center border-2 border-white">
                    <User className="h-8 w-8 text-white" />
                  </div>
                )}
                <button
                  onClick={() => setShowPhotoCapture(true)}
                  className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
                >
                  <Camera className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="ml-4 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">Bienvenido, {user.name}</h1>
                  {/* ONLINE badge for recyclers */}
                  {user.type === 'recycler' && user.online === true && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-400">
                      ONLINE
                    </span>
                  )}
                </div>
                <p className="text-green-100">
                  {user.type === 'recycler' ? 'Panel de Reciclador' : 'Panel de Residente'}
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px items-center">
              <button
                onClick={() => setActiveTab('points')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'points'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {user.type === 'recycler' ? 'Puntos Reclamados' : 'Mis Puntos de Recolección'}
              </button>
              {user.type === 'resident' && (
                <button
                  onClick={() => setActiveTab('recyclers')}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                    activeTab === 'recyclers'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Recicladores
                </button>
              )}
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Historial
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'profile'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Mi Perfil
              </button>
              {/* Nueva pestaña de Mensajes para recicladores */}
              {user.type === 'recycler' && (
                <>
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'messages'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Mensajes
                  </button>
                  {/* Botón al lado de Mensajes */}
                  <Link
                    to="/collection-points"
                    className="ml-2 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 font-semibold transition text-sm"
                  >
                    Ver todos los Puntos de Recolección
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Dashboard Content */}
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {geoErrorBanner}

            {/* Collection Points Tab */}
            {activeTab === 'points' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {user.type === 'recycler' ? 'Puntos de Recolección Reclamados' : 'Mis Puntos de Recolección'}
                  </h2>
                  
                  {user.type === 'resident' && (
                    <Link
                      to="/add-collection-point"
                      className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Punto
                    </Link>
                  )}
                </div>

                {collectionPoints.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {collectionPoints.map((point) => (
                      <div key={point.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="p-6">
                          {/* Point Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <MapPin className="h-6 w-6 text-green-500" />
                              </div>
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">{point.address}</h3>
                                <p className="mt-1 text-sm text-gray-500">{point.district}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              point.status === 'claimed' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : point.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {point.status === 'claimed' 
                                ? 'Reclamado'
                                : point.status === 'completed'
                                ? 'Completado'
                                : 'Disponible'}
                            </span>
                          </div>

                          {/* Materials */}
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700">Materiales:</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {point.materials.map((material, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                >
                                  {material}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Schedule */}
                          <div className="mt-4 flex items-center text-sm text-gray-500">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>{point.schedule}</span>
                          </div>

                          {/* Countdown Timer */}
                          {point.status === 'claimed' && point.pickup_time && (
                            <CountdownTimer
                              targetDate={new Date(point.pickup_time)}
                              onComplete={() => {
                                // Handle completion
                                console.log('Countdown completed for point:', point.id);
                              }}
                            />
                          )}

                          {/* Contact Information for Recyclers */}
                          {user.type === 'recycler' && (point.status === 'claimed' || point.status === 'pending') && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <h4 className="text-sm font-medium text-gray-700 mb-3">
                                Información del Reclamo:
                              </h4>
                              <div className="space-y-2 text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Estado:</span> {point.status}
                                </div>
                                <div>
                                  <span className="font-medium">Fecha de Reclamo:</span>{' '}
                                  {point.claimed_by ? new Date(point.claimed_by).toLocaleString() : 'N/A'}
                                </div>
                                {point.completed_at && (
                                  <div>
                                    <span className="font-medium">Completado el:</span>{' '}
                                    {new Date(point.completed_at).toLocaleString()}
                                  </div>
                                )}
                                {point.cancelled_at && (
                                  <div>
                                    <span className="font-medium">Cancelado el:</span>{' '}
                                    {new Date(point.cancelled_at).toLocaleString()}
                                  </div>
                                )}
                                {point.cancellation_reason && (
                                  <div>
                                    <span className="font-medium">Motivo de Cancelación:</span> {point.cancellation_reason}
                                  </div>
                                )}
                                {point.pickup_time && (
                                  <div>
                                    <span className="font-medium">Hora de Recolección:</span>{' '}
                                    {new Date(point.pickup_time).toLocaleString()}
                                  </div>
                                )}
                                {typeof point.estimated_weight === 'number' && (
                                  <div>
                                    <span className="font-medium">Peso Estimado:</span> {point.estimated_weight} kg
                                  </div>
                                )}
                              </div>
                              {/* Action Buttons */}
                              <div className="mt-4 grid grid-cols-2 gap-3">
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
                                  onClick={() => handleVerRutaGoogleMaps(point)}
                                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                                >
                                  <MapIcon className="h-4 w-4 mr-2" />
                                  Ver Ruta en Google Maps
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedClaim({ id: point.claim_id!, pointId: point.id });
                                    setShowCancelClaimModal(true);
                                  }}
                                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 col-span-2"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar Reclamación
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Delete Button for Residents */}
                          {user.type === 'resident' && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => {
                                  setPointToDelete(point.id);
                                  setShowDeleteConfirm(true);
                                }}
                                className="flex items-center text-red-600 hover:text-red-700"
                                title="Eliminar punto"
                              >
                                <Trash2 className="h-5 w-5 mr-1" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          )}

                          {/* Claim Button for Recyclers */}
                          {user.type === 'recycler' && point.status === 'available' && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => handleClaimPoint(point.id)}
                                className="flex items-center text-green-600 hover:text-green-700"
                                title="Reclamar punto"
                              >
                                <Star className="h-5 w-5 mr-1" />
                                <span>Reclamar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No hay puntos de recolección {user.type === 'recycler' ? 'reclamados' : 'registrados'}.</p>
                    {user.type === 'resident' && (
                      <Link
                        to="/add-collection-point"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Punto de Recolección
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recyclers Tab */}
            {activeTab === 'recyclers' && user.type === 'resident' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Recicladores Disponibles</h2>
                {recyclers.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {recyclers.map((recycler) => (
                      <div
                        key={recycler.id}
                        className="bg-white rounded-lg shadow p-4 flex flex-col items-center text-center"
                      >
                        {recycler.profiles?.avatar_url ? (
                          <img
                            src={recycler.profiles.avatar_url}
                            alt={recycler.profiles.name}
                            className="h-20 w-20 rounded-full object-cover mb-2"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-2">
                            <User className="h-10 w-10 text-green-600" />
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-gray-900">{recycler.profiles?.name}</h3>
                        {/* Etiqueta de estado en línea */}
                        {typeof recycler.online === 'boolean' && (
                          <span className={`inline-block mt-1 mb-1 px-3 py-1 rounded-full text-xs font-semibold
                            ${recycler.online ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                            {recycler.online ? 'En Línea' : 'Fuera de Línea'}
                          </span>
                        )}
                        <div className="flex items-center justify-center mt-1 mb-2">
                          <Star className="h-5 w-5 text-yellow-400" />
                          <span className="ml-1 text-base text-gray-700 font-medium">
                            {recycler.rating_average ? recycler.rating_average.toFixed(1) : 'Sin calificaciones'}
                          </span>
                          {typeof recycler.total_ratings === 'number' && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({recycler.total_ratings} reseñas)
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Materiales:</span>{' '}
                          {Array.isArray(recycler.materials)
                            ? recycler.materials.join(', ')
                            : 'No especificado'}
                        </div>
                        {recycler.profiles?.phone && (
                          <div className="text-xs text-gray-500 flex items-center justify-center">
                            <Phone className="h-4 w-4 mr-1" />
                            {recycler.profiles.phone}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No hay recicladores registrados en el sistema.</p>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Historial de Recolección</h2>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {user.type === 'recycler' ? 'Residente' : 'Reciclador'}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Materiales
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Add history items here */}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Mi Perfil- Residente</h2>
                <div className="flex items-center mb-6">
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt={profileData.name}
          className="h-20 w-20 rounded-full object-cover border-2 border-green-500"
        />
      ) : (
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <User className="h-10 w-10 text-green-600" />
        </div>
      )}
      <div className="ml-4">
        <h3 className="text-xl font-bold">{profileData.name}</h3>
        <p className="text-gray-500">{user.type === 'recycler' ? 'Reciclador' : 'Residente'}</p>
        {/* Etiqueta de estado en línea para reciclador */}
        {user.type === 'recycler' && (
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold
            ${user.online === true ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
            {user.online === true ? 'En Línea' : 'Fuera de Línea'}
          </span>
        )}
        {/* ...ranking si aplica... */}
      </div>
    </div>
                <div className="bg-white rounded-lg border p-6">
                  <div className="space-y-6">
                    <div>
                      <h3  className="text-lg font-medium text-gray-900">Información Personal</h3>
                      <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Nombre completo
                          </label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            value={profileData.name}
                            onChange={handleProfileChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div> </div>
                                    
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Correo electrónico
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={profileData.email}
                            onChange={handleProfileChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                            Teléfono
                          </label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={profileData.phone}
                            onChange={handleProfileChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                                      
                        <div>
                          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                            Dirección
                          </label>
                          <input
                            type="text"
                            id="address"
                            name="address"
                            value={profileData.address}
                            onChange={handleProfileChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                    {user.type === 'recycler' && (
                      <>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">Información de Reciclador</h3>
                          <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                            <div className="sm:col-span-2">
                              <label htmlFor="materials" className="block text-sm font-medium text-gray-700">
                                Materiales que recolecta
                              </label>
                              <input
                                type="text"
                                id="materials"
                                name="materials"
                                value={profileData.materials}
                                onChange={handleProfileChange}
                                placeholder="Ej: Papel, Cartón, Plástico"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                              />
                              <p className="mt-1 text-sm text-gray-500">Separe los materiales con comas</p>
                            </div>
                            
                            <div className="sm:col-span-2">
                              <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                                Biografía
                              </label>
                              <textarea
                                id="bio"
                                name="bio"
                                rows={4}
                                value={profileData.bio}
                                onChange={handleProfileChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Cuéntanos sobre tu experiencia como reciclador..."
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                            onClick={handleSaveProfile}
                          >
                            Guardar Cambios
                          </button>
                        </div>
                      </>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mensajes Tab */}
            {activeTab === 'messages' && user.type === 'recycler' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Mensajes de Residentes</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Lista de conversaciones */}
                  <div className="col-span-1">
                    <h3 className="text-lg font-medium mb-2">Conversaciones</h3>
                    <ul>
                      {conversations.length === 0 && (
                        <li className="text-gray-500">No tienes mensajes aún.</li>
                      )}
                      {conversations.map((conv) => (
                        <li
                          key={conv.user_id}
                          className={`p-2 rounded cursor-pointer mb-2 ${selectedConversation?.user_id === conv.user_id ? 'bg-green-100' : 'hover:bg-gray-100'}`}
                          onClick={() => setSelectedConversation(conv)}
                        >
                          <div className="flex items-center gap-2">
                            {conv.profiles?.avatar_url ? (
                              <img src={conv.profiles.avatar_url} alt={conv.profiles.name} className="h-8 w-8 rounded-full" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-green-200 flex items-center justify-center">
                                <span className="text-green-700 font-bold">{conv.profiles?.name?.[0] || '?'}</span>
                              </div>
                            )}
                            <span>{conv.profiles?.name || conv.user_id}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Chat */}
                  <div className="col-span-2">
                    {selectedConversation ? (
                      <div className="flex flex-col h-96 border rounded p-4 bg-gray-50">
                        <div className="flex-1 overflow-y-auto mb-2">
                          {chatMessages.length === 0 ? (
                            <p className="text-gray-400 text-center mt-10">No hay mensajes aún.</p>
                          ) : (
                            chatMessages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`mb-2 ${msg.sender_id === user.id ? 'text-right' : 'text-left'}`}
                              >
                                <span className="block text-xs text-gray-400">
                                  {msg.sender_id === user.id ? 'Tú' : selectedConversation.profiles?.name || 'Residente'} - {new Date(msg.created_at).toLocaleTimeString()}
                                </span>
                                <span className={`inline-block ${msg.sender_id === user.id ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'} rounded px-2 py-1 text-sm mt-1`}>
                                  {msg.text}
                                </span>
                              </div>
                            ))
                         ) }
                        </div>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 border rounded px-2 py-1"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                          />
                          <button onClick={handleSendMessage} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">Enviar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-96 text-gray-400">
                        Selecciona una conversación para ver los mensajes.
                      </div>
                    )}
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
export default Dashboard;

export interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}


