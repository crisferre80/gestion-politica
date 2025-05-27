import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Phone, Mail, MapIcon, X, User } from 'lucide-react';
import { supabase, type CollectionPoint, cancelClaim } from '../lib/supabase';
import Map from '../components/Map';
import CountdownTimer from '../components/CountdownTimer';
import { useUser } from '../context/UserContext';
import HeaderRecycler from '../components/HeaderRecycler';

const DashboardRecycler: React.FC = () => {
  const { user } = useUser();
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<CollectionPoint | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showCancelClaimModal, setShowCancelClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<{ id: string; pointId: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [activeTab, setActiveTab] = useState('mis-puntos-reclamados');
  // Estado para edición de perfil
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editMaterials, setEditMaterials] = useState(user?.materials?.join(', ') || '');
  const [editExperience, setEditExperience] = useState((user as any)?.experience_years || 0);
  const [editServiceAreas, setEditServiceAreas] = useState(((user as any)?.service_areas || []).join(', '));
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar puntos reclamados y disponibles
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Reclamos del reciclador
      if (!user) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
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
      const claimedPoints = claimsData.map(claim => ({
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
      const { data: availablePoints, error: availableError } = await supabase
        .from('collection_points')
        .select(`*, profiles!collection_points_user_id_fkey (name, email, phone, avatar_url)`)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (availableError) throw availableError;
      const availablePointsFormatted = availablePoints.map(point => ({
        ...point,
        creator_name: point.profiles?.name,
        creator_email: point.profiles?.email,
        creator_phone: point.profiles?.phone,
        creator_avatar: point.profiles?.avatar_url,
      }));
      setCollectionPoints([...claimedPoints, ...availablePointsFormatted]);
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

  // Reclamar punto
  const reclamarPunto = async (pointId: string) => {
    if (!user) {
      setError('Usuario no autenticado');
      return;
    }
    try {
      setError(null);
      // Insertar reclamo en la tabla collection_claims
      const { error: claimError } = await supabase
        .from('collection_claims')
        .insert([
          {
            collection_point_id: pointId,
            recycler_id: user.id,
            status: 'claimed',
            claimed_at: new Date().toISOString(),
          },
        ]);
      if (claimError) throw claimError;
      // Actualizar el estado del punto a 'claimed'
      const { error: updateError } = await supabase
        .from('collection_points')
        .update({ status: 'claimed' })
        .eq('id', pointId);
      if (updateError) throw updateError;
      await fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Error al reclamar el punto');
      } else {
        setError('Error al reclamar el punto');
      }
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
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header con tabs y submenus */}
          <HeaderRecycler activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {/* Secciones de Mis Puntos */}
            {activeTab === 'mis-puntos-reclamados' && (
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Puntos de Recolección Reclamados</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {collectionPoints.filter(p => p.status === 'claimed').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No tienes puntos reclamados.</div>
                  )}
                  {collectionPoints.filter(p => p.status === 'claimed').map(point => (
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Reclamado</span>
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
                        {point.pickup_time && (
                          <div className="mt-2 text-xs text-gray-500">Retiro programado: {new Date(point.pickup_time).toLocaleString()}</div>
                        )}
                        {point.status === 'claimed' && point.pickup_time && (
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
                              Cancelar Reclamo
                            </button>
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
                  {collectionPoints.filter(p => p.status === 'cancelled').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No tienes puntos cancelados.</div>
                  )}
                  {collectionPoints.filter(p => p.status === 'cancelled').map(point => (
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
                  {collectionPoints.filter(p => p.status === 'completed').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No tienes puntos retirados.</div>
                  )}
                  {collectionPoints.filter(p => p.status === 'completed').map(point => (
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
                    const formMaterials = editMaterials.split(',').map((m) => m.trim()).filter(Boolean);
                    const { error: updateError } = await supabase.from('profiles').update({
                      name: editName,
                      email: editEmail,
                      phone: editPhone,
                      address: editAddress,
                      bio: editBio,
                      materials: formMaterials,
                      experience_years: editExperience,
                      service_areas: editServiceAreas.split(',').map((a) => a.trim()).filter(Boolean),
                    }).eq('user_id', user.id);
                    if (!updateError) {
                      setSuccess('Perfil actualizado correctamente');
                      // Opcional: recargar datos de usuario
                    } else {
                      setError('Error al actualizar el perfil');
                    }
                  }}
                >
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-green-600 flex items-center justify-center mb-2">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
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
                    <div>
                      <label className="text-gray-600 text-sm">Años de experiencia</label>
                      <input type="number" min="0" className="font-semibold w-full border rounded px-2 py-1" value={editExperience} onChange={e => setEditExperience(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-gray-600 text-sm">Zonas de servicio (separadas por coma)</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editServiceAreas} onChange={e => setEditServiceAreas(e.target.value)} />
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
                    <div className="text-3xl font-bold text-green-700">{collectionPoints.filter(p => p.status === 'claimed').length}</div>
                    <div className="text-gray-600 mt-1">Reclamados</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-700">{collectionPoints.filter(p => p.status === 'cancelled').length}</div>
                    <div className="text-gray-600 mt-1">Cancelados</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">{collectionPoints.filter(p => p.status === 'completed').length}</div>
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
            {/* Secciones de Mis Puntos */}
            {activeTab === 'mis-puntos-disponibles' && (
              <>
                <h2 className="text-xl font-semibold text-green-700 mb-4">Puntos Disponibles para Reclamar</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {collectionPoints.filter(p => p.status === 'available').length === 0 && (
                    <div className="col-span-2 text-center text-gray-500">No hay puntos disponibles para reclamar en este momento.</div>
                  )}
                  {collectionPoints.filter(p => p.status === 'available').map(point => (
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
                            onClick={() => reclamarPunto(point.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold shadow"
                          >
                            Reclamar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPoint(point);
                              setShowMap(true);
                            }}
                            className="px-4 py-2 bg-gray-100 text-green-700 rounded hover:bg-green-200 font-semibold border border-green-400"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardRecycler;









