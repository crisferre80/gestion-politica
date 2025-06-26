import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Plus, User as UserIcon, Mail, Phone, Trash2, QrCode } from 'lucide-react';
import Map from '../components/Map';
import QRCode from 'react-qr-code';

// Tipo para el payload de realtime de perfiles (igual que en DashboardResident.tsx)
type ProfileRealtimePayload = {
  dni?: string;
  id: string;
  user_id?: string;
  avatar_url?: string;
  name?: string;
  email?: string;
  phone?: string;
  rating_average?: number;
  total_ratings?: number;
  materials?: string[] | string;
  bio?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  online?: boolean | string | number;
  role?: string;
};

// Panel exclusivo para residentes institucionales (empresas, edificios, instituciones)
const DashboardInstitutional: React.FC = () => {
  const { user } = useUser();
  type CollectionPoint = {
    id: string;
    user_id: string;
    address: string;
    district?: string;
    materials?: string[];
    schedule?: string;
    additional_info?: string;
    status?: string;
    lat?: number | string | null;
    lng?: number | string | null;
    description?: string;
    pickup_time?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
    const [collectivePoint, setCollectivePoint] = useState<CollectionPoint | null>(null);
  type Resident = {
    id: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    user_id?: string;
  };
  const [associatedResidents, setAssociatedResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  type Recycler = {
    id: string;
    user_id?: string;
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
  };
  const [recyclers, setRecyclers] = useState<Recycler[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);

  // Estado para detalle de residente seleccionado
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [residentPoints, setResidentPoints] = useState<CollectionPoint[]>([]);
  const [residentLoading, setResidentLoading] = useState(false);
  const [totals, setTotals] = useState<{ materiales: Record<string, number>; bultos: number }>({ materiales: {}, bultos: 0 });

  // Estado para el reclamo del punto colectivo
  const [collectivePointClaim, setCollectivePointClaim] = useState<{
    id: string;
    status: string;
    recycler_id: string;
    pickup_time?: string;
    recycler_name?: string;
    recycler_avatar?: string;
    recycler_phone?: string;
    created_at?: string;
  } | null>(null);

  // Estado para el menú de contacto del reciclador
  const [showContactMenu, setShowContactMenu] = useState(false);

  useEffect(() => {
    if (!user || user.type !== 'resident_institutional') return;
    const fetchData = async () => {
      // Buscar el punto colectivo creado por este usuario
      const { data: points } = await supabase
        .from('collection_points')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);
      setCollectivePoint(points && points.length > 0 ? points[0] : null);
      
      // Buscar reclamo del punto colectivo si existe
      if (points && points.length > 0) {
        const collectivePointId = points[0].id;
        const { data: claimData, error: claimError } = await supabase
          .from('collection_claims')
          .select('*, profiles!collection_claims_recycler_id_fkey(name, avatar_url, phone)')
          .eq('collection_point_id', collectivePointId)
          .eq('status', 'claimed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (claimError) {
          console.error('Error al buscar reclamo del punto colectivo:', claimError);
        } else if (claimData) {
          console.log('Reclamo del punto colectivo encontrado:', claimData);
          setCollectivePointClaim({
            id: claimData.id,
            status: claimData.status,
            recycler_id: claimData.recycler_id,
            pickup_time: claimData.pickup_time,
            created_at: claimData.created_at,
            recycler_name: claimData.profiles?.name,
            recycler_avatar: claimData.profiles?.avatar_url,
            recycler_phone: claimData.profiles?.phone,
          });
        } else {
          setCollectivePointClaim(null);
        }
      }
      // Buscar residentes asociados a la misma dirección
      if (points && points.length > 0) {
        console.log('Punto colectivo encontrado:', points[0]);
        const { data: residents, error: residentsError } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, user_id')
          .eq('address', points[0].address)
          .neq('user_id', user.id);
        
        if (residentsError) {
          console.error('Error al buscar residentes asociados:', residentsError);
        } else {
          console.log('Residentes asociados encontrados:', residents);
          setAssociatedResidents(residents || []);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleDeletePoint = async () => {
    if (!collectivePoint) return;
    if (window.confirm('¿Estás seguro de que quieres eliminar este punto colectivo? Esta acción es irreversible.')) {
      const { error } = await supabase.from('collection_points').delete().eq('id', collectivePoint.id);
      if (error) {
        alert('Error al eliminar el punto: ' + error.message);
      } else {
        setCollectivePoint(null);
        setAssociatedResidents([]);
      }
    }
  };

  // Suscripción realtime a recicladores online
  useEffect(() => {
    const channel = supabase.channel('recyclers-profiles-institutional')
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
          // Solo procesar si tiene id y role
          if (newRec && newRec.id && newRec.role && newRec.role.toLowerCase() === 'recycler') {
            setRecyclers((prev) => {
              const exists = prev.find(r => r.id === String(newRec.id));
              const normalizedMaterials = Array.isArray(newRec.materials)
                ? newRec.materials
                : (typeof newRec.materials === 'string' && newRec.materials.length > 0
                    ? [newRec.materials]
                    : []);
              const normalizedOnline = newRec.online === true || newRec.online === 'true' || newRec.online === 1;
              const normalizedLat = typeof newRec.lat === 'number' ? newRec.lat : (newRec.lat !== null && newRec.lat !== undefined ? Number(newRec.lat) : undefined);
              const normalizedLng = typeof newRec.lng === 'number' ? newRec.lng : (newRec.lng !== null && newRec.lng !== undefined ? Number(newRec.lng) : undefined);
              if (exists) {
                return prev.map(r =>
                  r.id === String(newRec.id)
                    ? {
                        ...r,
                        online: normalizedOnline,
                        lat: normalizedLat,
                        lng: normalizedLng,
                        materials: normalizedMaterials,
                        avatar_url: newRec.avatar_url || r.avatar_url,
                        name: newRec.name || r.name,
                        email: newRec.email || r.email,
                        phone: newRec.phone || r.phone,
                        bio: newRec.bio || r.bio,
                      }
                    : r
                ).filter(r => r.online === true);
              } else {
                if (normalizedOnline) {
                  return [
                    ...prev,
                    {
                      id: String(newRec.id),
                      user_id: newRec.user_id,
                      avatar_url: newRec.avatar_url,
                      name: newRec.name,
                      email: newRec.email,
                      phone: newRec.phone,
                      rating_average: newRec.rating_average,
                      total_ratings: newRec.total_ratings,
                      materials: normalizedMaterials,
                      bio: newRec.bio,
                      lat: normalizedLat,
                      lng: normalizedLng,
                      online: normalizedOnline,
                    }
                  ];
                } else {
                  return prev;
                }
              }
            });
          }
          if (payload.eventType === 'DELETE' && oldRec && oldRec.id && oldRec.role && oldRec.role.toLowerCase() === 'recycler') {
            setRecyclers((prev) => prev.filter((r) => r.id !== String(oldRec.id)));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Suscripción en tiempo real a reclamos del punto colectivo
  useEffect(() => {
    if (!collectivePoint) return;
    
    const channel = supabase.channel('collective-point-claims')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collection_claims',
          filter: `collection_point_id=eq.${collectivePoint.id}`,
        },
        async (payload) => {
          console.log('Cambio en reclamo del punto colectivo:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const claimData = payload.new;
            if (claimData.status === 'claimed') {
              // Obtener información del reciclador
              const { data: recyclerProfile } = await supabase
                .from('profiles')
                .select('name, avatar_url, phone')
                .eq('user_id', claimData.recycler_id)
                .single();
              
              setCollectivePointClaim({
                id: claimData.id,
                status: claimData.status,
                recycler_id: claimData.recycler_id,
                pickup_time: claimData.pickup_time,
                created_at: claimData.created_at,
                recycler_name: recyclerProfile?.name,
                recycler_avatar: recyclerProfile?.avatar_url,
                recycler_phone: recyclerProfile?.phone,
              });
            } else if (claimData.status === 'completed' || claimData.status === 'cancelled') {
              setCollectivePointClaim(null);
            }
          } else if (payload.eventType === 'DELETE') {
            setCollectivePointClaim(null);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [collectivePoint]);

  // Cerrar menú de contacto al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContactMenu(false);
    };
    
    if (showContactMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showContactMenu]);

  // Carga inicial de recicladores online con coordenadas válidas
  useEffect(() => {
    const fetchRecyclers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'recycler')
        .eq('online', true);
      if (error) {
        console.error('[INSTITUTIONAL] Error al cargar recicladores:', error);
        return;
      }
      if (data && Array.isArray(data)) {
        const filtered = data.filter(r => {
          const lat = typeof r.lat === 'number' ? r.lat : (r.lat !== null && r.lat !== undefined ? Number(r.lat) : undefined);
          const lng = typeof r.lng === 'number' ? r.lng : (r.lng !== null && r.lng !== undefined ? Number(r.lng) : undefined);
          return r.online === true && typeof lat === 'number' && typeof lng === 'number';
        }).map(r => ({
          id: String(r.id),
          user_id: r.user_id,
          avatar_url: r.avatar_url,
          name: r.name,
          email: r.email,
          phone: r.phone,
          rating_average: r.rating_average,
          total_ratings: r.total_ratings,
          materials: Array.isArray(r.materials) ? r.materials : (typeof r.materials === 'string' && r.materials.length > 0 ? [r.materials] : []),
          bio: r.bio,
          lat: typeof r.lat === 'number' ? r.lat : (r.lat !== null && r.lat !== undefined ? Number(r.lat) : undefined),
          lng: typeof r.lng === 'number' ? r.lng : (r.lng !== null && r.lng !== undefined ? Number(r.lng) : undefined),
          online: r.online === true || r.online === 'true' || r.online === 1,
        }));
        setRecyclers(filtered);
        // console.log('[INSTITUTIONAL] Recyclers iniciales cargados:', filtered);
      }
    };
    fetchRecyclers();
  }, []);

  // Calcular totales de materiales y bultos de todos los residentes asociados
  useEffect(() => {
    const fetchTotals = async () => {
      if (associatedResidents.length === 0) {
        setTotals({ materiales: {}, bultos: 0 });
        return;
      }
      // Buscar todos los puntos de recolección de los residentes asociados
      const userIds = associatedResidents.map(r => r.user_id || r.id);
      console.log('Calculando totales para user_ids:', userIds);
      
      const { data: points } = await supabase
        .from('collection_points')
        .select('*')
        .in('user_id', userIds);
      // Sumar materiales y bultos
      const materiales: Record<string, number> = {};
      let bultos = 0;
      (points || []).forEach((p: CollectionPoint) => {
        if (Array.isArray(p.materials)) {
          p.materials.forEach((mat: string) => {
            materiales[mat] = (materiales[mat] || 0) + 1;
          });
        }
        if (typeof p.bultos === 'number') {
          bultos += p.bultos;
        }
      });
      setTotals({ materiales, bultos });
    };
    fetchTotals();
  }, [associatedResidents]);

  // Al seleccionar un residente, buscar todos sus puntos de recolección
  const handleSelectResident = async (res: Resident) => {
    console.log('Seleccionando residente:', res);
    setSelectedResident(res);
    setResidentLoading(true);
    setResidentPoints([]);
    
    try {
      // Buscar por user_id que es lo que se almacena en collection_points
      const userIdToSearch = res.user_id || res.id;
      console.log('Buscando puntos para user_id:', userIdToSearch);
      
      const { data: points, error } = await supabase
        .from('collection_points')
        .select('*')
        .eq('user_id', userIdToSearch);
      
      if (error) {
        console.error('Error al buscar puntos del residente:', error);
      } else {
        console.log('Puntos encontrados para el residente:', points);
        setResidentPoints(points || []);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
    } finally {
      setResidentLoading(false);
    }
  };

  if (!user || user.type !== 'resident_institutional') {
    return <div className="p-8 text-center text-red-600">Acceso solo para usuarios institucionales.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center p-4 mb-6 bg-white rounded-lg shadow-md">
        <img
          src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'E')}&background=0D8ABC&color=fff`}
          alt="Foto de perfil institucional"
          className="w-20 h-20 rounded-full mr-6 border-4 border-gray-100"
        />
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{user?.name}</h1>
          <p className="text-lg text-gray-500">Panel Institucional</p>
        </div>
      </div>
      {/* Botón Agregar Punto Colectivo arriba y visible */}
      <div className="flex gap-4 mb-6">
        <Link to="/add-collection-point" className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2">
          <Plus className="w-4 h-4" /> Agregar Punto Colectivo
        </Link>
      </div>
      {loading ? (
        <div>Cargando...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Punto Colectivo</h2>
            {collectivePoint ? (
              <div>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <img
                      src={
                        collectivePoint.type === 'colective_point'
                          ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
                          : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750822947/iconmepresa_qbqqmx.png'
                      }
                      alt="Icono de Punto Colectivo"
                      className="w-12 h-12 mr-4"
                    />
                    <p className="text-gray-600">{collectivePoint.address}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Materiales clasificados:</h3>
                    <div className="flex flex-wrap gap-2">
                      {collectivePoint.materials?.map((material) => (
                        <span key={material} className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {material}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <h3 className="font-semibold text-gray-700 mr-2">Estado:</h3>
                    {collectivePointClaim ? (
                      <div className="flex flex-col gap-2">
                        <span className="bg-orange-100 text-orange-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                          Reclamado por Reciclador
                        </span>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          {collectivePointClaim.recycler_avatar && (
                            <img 
                              src={collectivePointClaim.recycler_avatar} 
                              alt="Reciclador" 
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <span className="font-medium">
                            {collectivePointClaim.recycler_name || 'Reciclador'}
                          </span>
                          {collectivePointClaim.recycler_phone && (
                            <span className="text-xs text-gray-500">
                              • {collectivePointClaim.recycler_phone}
                            </span>
                          )}
                        </div>
                        {collectivePointClaim.pickup_time && (
                          <div className="text-xs text-gray-500">
                            <strong>Hora programada:</strong> {new Date(collectivePointClaim.pickup_time).toLocaleString('es-ES')}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          <strong>Reclamado:</strong> {new Date(collectivePointClaim.created_at || '').toLocaleString('es-ES')}
                        </div>
                      </div>
                    ) : (
                      <span className="bg-blue-100 text-blue-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded-full">
                        Disponible
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-2">
                  {collectivePointClaim && (
                    <div className="relative">
                      <button
                        onClick={() => setShowContactMenu(!showContactMenu)}
                        className="px-3 py-2 bg-green-600 text-white rounded-md flex items-center gap-2 hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Contactar Reciclador
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showContactMenu && (
                        <>
                          {/* Overlay para cerrar el menú */}
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowContactMenu(false)}
                          ></div>
                          
                          {/* Menú desplegable */}
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  if (collectivePointClaim.recycler_phone) {
                                    window.open(`tel:${collectivePointClaim.recycler_phone}`, '_self');
                                  } else {
                                    alert('No hay número de teléfono disponible para este reciclador');
                                  }
                                  setShowContactMenu(false);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <Phone className="w-4 h-4 mr-3 text-blue-500" />
                                Llamar
                              </button>
                              
                              <button
                                onClick={() => {
                                  if (collectivePointClaim.recycler_phone) {
                                    // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
                                    const cleanPhone = collectivePointClaim.recycler_phone.replace(/[\s\-\(\)]/g, '');
                                    const institutionName = user?.name || 'nuestra institución';
                                    const recyclerName = collectivePointClaim.recycler_name || 'reciclador';
                                    const scheduledTime = collectivePointClaim.pickup_time 
                                      ? new Date(collectivePointClaim.pickup_time).toLocaleString('es-ES')
                                      : 'la hora programada';
                                    
                                    const message = `Hola ${recyclerName}! Te contacto desde *${institutionName}* a través de EcoNecta 🌱\n\nVeo que reclamaste nuestro punto de recolección colectivo para el ${scheduledTime}.\n\n¿Podrías confirmarme el estado de la recolección? ¡Muchas gracias por tu trabajo! ♻️`;
                                    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                                    window.open(whatsappUrl, '_blank');
                                  } else {
                                    alert('No hay número de teléfono disponible para este reciclador');
                                  }
                                  setShowContactMenu(false);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4 mr-3 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                                </svg>
                                WhatsApp
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
                    disabled={!!collectivePointClaim}
                    title={collectivePointClaim ? "No se puede invitar mientras el punto está reclamado" : "Invitar con QR"}
                  >
                    <QrCode className="w-4 h-4" />
                    Invitar con QR
                  </button>
                  <button
                    onClick={handleDeletePoint}
                    className="px-3 py-2 bg-red-600 text-white rounded-md flex items-center gap-2 hover:bg-red-700 transition-colors text-sm font-semibold shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={!!collectivePointClaim}
                    title={collectivePointClaim ? "No se puede eliminar mientras el punto está reclamado" : "Eliminar punto"}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No tienes un punto colectivo registrado.</p>
            )}
            
            {/* Información adicional del reclamo */}
            {collectivePointClaim && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Punto Reclamado - Información del Reciclador
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Reciclador:</strong> {collectivePointClaim.recycler_name || 'No disponible'}</p>
                    <p><strong>Teléfono:</strong> {collectivePointClaim.recycler_phone || 'No disponible'}</p>
                  </div>
                  <div>
                    <p><strong>Hora programada:</strong> {collectivePointClaim.pickup_time ? new Date(collectivePointClaim.pickup_time).toLocaleString('es-ES') : 'No especificada'}</p>
                    <p><strong>Reclamado el:</strong> {new Date(collectivePointClaim.created_at || '').toLocaleString('es-ES')}</p>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-800">
                  <strong>Nota:</strong> El punto colectivo está siendo atendido por un reciclador. No puedes eliminar el punto ni invitar nuevos residentes hasta que la recolección se complete.
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">Residentes Asociados</h2>
            {associatedResidents.length > 0 ? (
              <ul className="divide-y">
                {associatedResidents.map(res => (
                  <li key={res.id} className="py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded transition"
                    onClick={() => handleSelectResident(res)}
                  >
                    <img src={res.avatar_url || '/default-avatar.png'} alt={res.name} className="w-8 h-8 rounded-full" />
                    <span>{res.name} ({res.email})</span>
                    <button
                      className="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs flex items-center gap-1"
                      title="Eliminar residente"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm('¿Eliminar la asociación de este residente?')) {
                          const { error } = await supabase
                            .from('profiles')
                            .update({ address: null })
                            .eq('id', res.id);
                          if (error) {
                            alert('Error al eliminar la asociación: ' + error.message);
                          } else {
                            setAssociatedResidents(prev => prev.filter(r => r.id !== res.id));
                          }
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No hay residentes asociados a este punto colectivo.</div>
            )}
            {/* Detalle del residente seleccionado */}
            {selectedResident && (
              <div className="mt-4 p-4 bg-gray-50 rounded shadow">
                <h3 className="font-bold text-lg mb-2">Puntos de Recolección de {selectedResident.name}</h3>
                {residentLoading ? (
                  <div>Cargando puntos de recolección...</div>
                ) : residentPoints.length > 0 ? (
                  <div className="space-y-3">
                    {residentPoints.map((point, index) => (
                      <div key={point.id} className="p-4 bg-white rounded border shadow-sm">
                        <h4 className="font-semibold text-md mb-3 text-blue-600">Punto #{index + 1}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="mb-2"><b>Dirección:</b> {point.address}</div>
                            {point.district && (
                              <div className="mb-2"><b>Distrito:</b> {point.district}</div>
                            )}
                            <div className="mb-2"><b>Materiales:</b> {Array.isArray(point.materials) ? point.materials.join(', ') : 'N/A'}</div>
                            <div className="mb-2"><b>Bultos:</b> {typeof point.bultos === 'number' ? point.bultos : 0}</div>
                          </div>
                          <div>
                            {point.schedule && (
                              <div className="mb-2"><b>Horario:</b> {point.schedule}</div>
                            )}
                            {point.additional_info && (
                              <div className="mb-2"><b>Info adicional:</b> {point.additional_info}</div>
                            )}
                            <div className="mb-2"><b>Estado:</b> 
                              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                point.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                point.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                point.status === 'completed' ? 'bg-green-100 text-green-800' :
                                point.status === 'available' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {point.status === 'pending' ? 'Pendiente' :
                                 point.status === 'in_progress' ? 'En Progreso' :
                                 point.status === 'completed' ? 'Completado' :
                                 point.status === 'available' ? 'Disponible' :
                                 point.status || 'Sin Estado'}
                              </span>
                            </div>
                            {point.created_at && (
                              <div className="mb-2 text-sm text-gray-500">
                                <b>Creado:</b> {new Date(point.created_at).toLocaleDateString('es-ES')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                      <b>Total de puntos:</b> {residentPoints.length}
                    </div>
                  </div>
                ) : (
                  <div>Este residente no tiene puntos de recolección propios.</div>
                )}
                <button className="mt-2 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm" onClick={() => setSelectedResident(null)}>Cerrar</button>
              </div>
            )}
            {/* Totales de materiales y bultos de todos los residentes */}
            <div className="mt-4 p-4 bg-green-50 rounded shadow">
              <h3 className="font-bold text-lg mb-2">Totales del Punto Colectivo</h3>
              <div className="mb-2"><b>Bultos totales:</b> {totals.bultos}</div>
              <div><b>Materiales totales:</b> {Object.keys(totals.materiales).length === 0 ? 'N/A' : (
                <ul className="list-disc ml-6">
                  {Object.entries(totals.materiales).map(([mat, count]) => (
                    <li key={mat}>{mat}: {count}</li>
                  ))}
                </ul>
              )}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">Recicladores Online</h2>
            <Map
              markers={[
                ...recyclers
                  .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number' && r.online === true)
                  .map((rec) => ({
                    id: rec.id.toString(),
                    lat: rec.lat ?? 0,
                    lng: rec.lng ?? 0,
                    title: rec.name || 'Reciclador',
                    avatar_url: rec.avatar_url || undefined,
                    role: 'recycler',
                    online: rec.online === true,
                    iconUrl: '/assets/bicireciclador-Photoroom.png',
                  })),
                ...(collectivePoint && collectivePoint.lat && collectivePoint.lng
                  ? [
                      {
                        id: 'collective-point',
                        lat: Number(collectivePoint.lat),
                        lng: Number(collectivePoint.lng),
                        title: collectivePoint.address || 'Punto Colectivo',
                        role: collectivePoint.type === 'colective_point' ? 'colective_point' : 'collection_point',
                        iconUrl:
                          collectivePoint.type === 'colective_point'
                            ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
                            : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750822947/iconmepresa_qbqqmx.png',
                      },
                    ]
                  : []),
              ]}
              showUserLocation={true}
              showAdminZonesButton={false}
            />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {recyclers.filter(r => r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number').length === 0 ? (
                <div className="col-span-2 text-center text-gray-500">No hay recicladores en línea con ubicación disponible.</div>
              ) : (
                recyclers.filter(r => r.online === true && typeof r.lat === 'number' && typeof r.lng === 'number').map((rec) => (
                  <div key={rec.id} className="border rounded-lg p-4 flex flex-col items-center bg-gray-50 shadow-sm relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
                      {rec.avatar_url ? (
                        <img src={rec.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-green-700 mb-1 flex items-center gap-2">
                      {rec.name || 'Reciclador'}
                    </h3>
                    {rec.email && (
                      <p className="text-gray-500 text-sm mb-1 flex items-center"><Mail className="h-4 w-4 mr-1" />{rec.email}</p>
                    )}
                    {rec.phone && (
                      <p className="text-gray-500 text-sm mb-1 flex items-center"><Phone className="h-4 w-4 mr-1" />{rec.phone}</p>
                    )}
                    {rec.bio && <p className="text-gray-600 text-xs mt-2 text-center">{rec.bio}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Modal para mostrar el QR */}
          {showQrModal && collectivePoint && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
              <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md mx-4">
                <h3 className="text-2xl font-bold mb-4">Adhesión al Punto Colectivo</h3>
                <p className="mb-6 text-gray-600">Pide al residente que escanee este código QR para asociarse a tu punto de recolección.</p>
                <div style={{ background: 'white', padding: '16px', display: 'inline-block' }}>
                  <QRCode
                    value={`${window.location.origin}/join-point/${collectivePoint.id}`}
                    size={256}
                  />
                </div>
                <p className="mt-4 text-xs text-gray-500 break-all">
                  O comparte este enlace: <br/>
                  <a 
                    href={`${window.location.origin}/join-point/${collectivePoint.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {`${window.location.origin}/join-point/${collectivePoint.id}`}
                  </a>
                </p>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="mt-8 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors w-full"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardInstitutional;
