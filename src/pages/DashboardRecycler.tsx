import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Plus, Star, Phone, Mail, MapIcon, X, User, Camera, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase, type CollectionPoint, type RecyclerProfile, uploadProfilePhoto, cancelClaim, deleteCollectionPoint, fetchRecyclerProfiles, claimCollectionPoint } from '../lib/supabase';
import Map from '../components/Map';
import PhotoCapture from '../components/PhotoCapture';
import CountdownTimer from '../components/CountdownTimer';
import { useUser } from '../context/UserContext';

const Dashboard: React.FC = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'points' | 'recyclers' | 'history' | 'profile'>('points');
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
  });


  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (user?.type === 'resident') {
        // Fetch collection points
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
          .eq('status', 'available') // Solo mostrar puntos no reclamados
          .order('created_at', { ascending: false });

        if (pointsError) throw pointsError;

        // Fetch recycler profiles
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
        // For recyclers, fetch their claims
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

        // Transform claims data into collection points format
        const points = claimsData.map(claim => ({
          ...claim.collection_point,
          claim_id: claim.id,
          status: claim.status,
          creator_name: claim.collection_point?.profiles?.name || 'Usuario Anónimo',
          creator_email: claim.collection_point?.profiles?.email,
          creator_phone: claim.collection_point?.profiles?.phone,
          creator_avatar: claim.collection_point?.profiles?.avatar_url,
          pickup_time: claim.pickup_time
        }));

        setCollectionPoints(points);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
      if (user.avatar_url) {
        setProfilePhoto(user.avatar_url);
      }
    }
  }, [user, fetchData]);

  useEffect(() => {
    setProfileData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      materials: user?.materials?.join(', ') || '',
      bio: user?.bio || '',
    });
  }, [user]);

  useEffect(() => {
    const setOnlineStatus = async (online: boolean) => {
      if (user && user.type === 'recycler') {
        await supabase
          .from('profiles')
          .update({ online })
          .eq('id', user.id);
      }
    };

    // Al iniciar sesión, poner en línea
    if (user && user.type === 'recycler') {
      setOnlineStatus(true);
    }

    // Al cerrar o recargar la página, poner fuera de línea
    const handleBeforeUnload = () => {
      setOnlineStatus(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      setOnlineStatus(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  const handleCancelClaim = async () => {
    if (!selectedClaim || !user) return;

    try {
      setError(null);
      await cancelClaim(
        selectedClaim.id,
        selectedClaim.pointId,
        user.id,
        cancellationReason
      );

      // Remove the cancelled point from the list
      setCollectionPoints(points => points.filter(p => p.id !== selectedClaim.pointId));
      
      // Reset state
      setShowCancelClaimModal(false);
      setSelectedClaim(null);
      setCancellationReason('');
    } catch (err) {
      console.error('Error cancelling claim:', err);
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
    } catch (err) {
      console.error('Error deleting point:', err);
      setError('Error al eliminar el punto de recolección');
    }
  };

  const handlePhotoCapture = async (file: File) => {
    try {
      if (!user) return;
      const publicUrl = await uploadProfilePhoto(user.id, file);
      setProfilePhoto(publicUrl);
      setShowPhotoCapture(false);
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Error al subir la foto');
    }
  };

  // Nueva función para reclamar un punto
  const handleClaimPoint = async (pointId: string) => {
    if (!user) return;
    try {
      setError(null);
      // Llama a tu función para reclamar el punto (debes implementarla en tu backend/supabase)
      // Aquí puedes pedir al usuario que seleccione una fecha/hora o usar la actual como ejemplo
      const pickupTime = new Date().toISOString();
      await claimCollectionPoint(pointId, user.id, pickupTime);
      // Actualiza el estado local para reflejar el cambio inmediatamente
      setCollectionPoints(points =>
        points.map(p =>
          p.id === pointId ? { ...p, status: 'claimed' } : p
        )
      );
    } catch (err) {
      console.error('Error al reclamar el punto:', err);
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
      // Si es reciclador, separa los materiales
      const updatedData = {
        ...profileData,
        materials: user && user.type === 'recycler'
          ? profileData.materials.split(',').map(m => m.trim()).filter(Boolean)
          : undefined,
      };
      // Llama a tu función de actualización (debes implementarla en supabase/lib)
      await supabase
        .from('profiles')
        .update({
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          address: updatedData.address,
          ...((user && user.type === 'recycler') && {
            materials: updatedData.materials,
            bio: updatedData.bio,
          }),
        })
        .eq('id', user.id);

      // Opcional: recarga datos del usuario
      window.location.reload();
    } catch {
      setError('Error al actualizar el perfil');
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

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {showPhotoCapture && (
          <PhotoCapture 
            onCapture={handlePhotoCapture}
            onClose={() => setShowPhotoCapture(false)}
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
              <div className="ml-4">
                <h1 className="text-2xl font-bold">Bienvenido, {user.name}</h1>
                <p className="text-green-100">
                  {user.type === 'recycler' ? 'Panel de Reciclador' : 'Panel de Residente'}
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
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
            </nav>
          </div>

          {/* Dashboard Content */}
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

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
                          {user.type === 'recycler' && point.status === 'claimed' && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <h4 className="text-sm font-medium text-gray-700 mb-3">
                                Información del Residente:
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-500">
                                  <User className="h-4 w-4 mr-2" />
                                  <span>{point.creator_name}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <Mail className="h-4 w-4 mr-2" />
                                  <a href={`mailto:${point.creator_email}`} className="text-green-600 hover:text-green-700">
                                    {point.creator_email}
                                  </a>
                                </div>
                                {point.creator_name && (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Phone className="h-4 w-4 mr-2" />
                                    <a href={`tel:${point.creator_name}`} className="text-green-600 hover:text-green-700">
                                      {point.creator_name}
                                    </a>
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
                                  onClick={() => {
                                    setSelectedClaim({ id: point.claim_id!, pointId: point.id });
                                    setShowCancelClaimModal(true);
                                  }}
                                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar
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
            ${user.online ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
            {user.online ? 'En Línea' : 'Fuera de Línea'}
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
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;