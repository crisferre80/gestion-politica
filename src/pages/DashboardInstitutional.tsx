import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { MapPin, Plus, User as UserIcon, Mail, Phone } from 'lucide-react';
import Map from '../components/Map';

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
  const [collectivePoint, setCollectivePoint] = useState<any>(null);
  const [associatedResidents, setAssociatedResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recyclers, setRecyclers] = useState<any[]>([]);

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
      // Buscar residentes asociados a la misma dirección
      if (points && points.length > 0) {
        const { data: residents } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .eq('address', points[0].address)
          .neq('user_id', user.id);
        setAssociatedResidents(residents || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

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

  if (!user || user.type !== 'resident_institutional') {
    return <div className="p-8 text-center text-red-600">Acceso solo para usuarios institucionales.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Panel Institucional</h1>
      {loading ? (
        <div>Cargando...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">Punto Colectivo</h2>
            {collectivePoint ? (
              <div>
                <p><MapPin className="inline mr-2" /> <b>Dirección:</b> {collectivePoint.address}</p>
                <p><b>Materiales:</b> {collectivePoint.materials?.join(', ')}</p>
                <p><b>Estado:</b> {collectivePoint.status}</p>
                {/* Aquí puedes agregar edición de punto colectivo si lo deseas */}
              </div>
            ) : (
              <div>No tienes un punto colectivo registrado.</div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">Residentes Asociados</h2>
            {associatedResidents.length > 0 ? (
              <ul className="divide-y">
                {associatedResidents.map(res => (
                  <li key={res.id} className="py-2 flex items-center gap-2">
                    <img src={res.avatar_url || '/default-avatar.png'} alt={res.name} className="w-8 h-8 rounded-full" />
                    <span>{res.name} ({res.email})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No hay residentes asociados a este punto colectivo.</div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">Recicladores Online</h2>
            <Map
              markers={recyclers
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
                }))}
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
          <div className="flex gap-4">
            <Link to="/add-collection-point" className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2">
              <Plus className="w-4 h-4" /> Editar Punto Colectivo
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardInstitutional;
