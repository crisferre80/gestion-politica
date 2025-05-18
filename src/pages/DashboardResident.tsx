import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Plus, Trash2, Clock, User as UserIcon, Mail, Phone, Star } from 'lucide-react';
import { supabase, deleteCollectionPoint } from '../lib/supabase';
import Map from '../components/Map';
import { useUser } from '../context/UserContext';

type CollectionPoint = {
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

const DashboardResident: React.FC = () => {
  const { user } = useUser();
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'puntos' | 'recicladores' | 'perfil' | 'historial'>('puntos');
  type Recycler = {
    id: number;
    profiles?: {
      avatar_url?: string;
      name?: string;
      email?: string;
      phone?: string;
    };
    rating_average?: number;
    total_ratings?: number;
    materials?: string[];
    bio?: string;
    lat?: number;
    lng?: number;
    online?: boolean;
  };
  
    const [recyclers, setRecyclers] = useState<Recycler[]>([]);
  const [loadingRecyclers, setLoadingRecyclers] = useState(false);
  const avatarUrl = user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.name || 'Residente') + '&background=22c55e&color=fff&size=128';

  useEffect(() => {
    const fetchCollectionPoints = async () => {
      const { data, error } = await supabase
        .from('collection_points')
        .select('*')
        .eq('user_id', user?.id);
      if (error) {
        setError('Error al cargar los puntos de recolección');
      } else {
        setCollectionPoints(data);
      }
    };
    if (user) {
      fetchCollectionPoints();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'recicladores') {
      setLoadingRecyclers(true);
      // Cambiar: leer recicladores directamente de profiles
      const fetchRecyclers = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'recycler');
        if (error) {
          setRecyclers([]);
        } else {
          setRecyclers(
            (data || []).map((rec) => ({
              id: rec.id,
              profiles: {
                avatar_url: rec.avatar_url,
                name: rec.name,
                email: rec.email,
                phone: rec.phone,
              },
              rating_average: rec.rating_average || 0,
              total_ratings: rec.total_ratings || 0,
              materials: rec.materials || [],
              bio: rec.bio || '',
            }))
          );
        }
        setLoadingRecyclers(false);
      };
      fetchRecyclers();
    }
  }, [activeTab]);

  // Polling para actualizar recicladores en tiempo real
  useEffect(() => {
    if (activeTab !== 'puntos') return;

    const fetchRecyclersRealtime = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'recycler');
      if (!error && data) {
        setRecyclers(
          (data || []).map((rec) => ({
            id: rec.id,
            profiles: {
              avatar_url: rec.avatar_url,
              name: rec.name,
              email: rec.email,
              phone: rec.phone,
            },
            rating_average: rec.rating_average || 0,
            total_ratings: rec.total_ratings || 0,
            materials: rec.materials || [],
            bio: rec.bio || '',
            lat: rec.lat,
            lng: rec.lng,
            online: rec.online,
          }))
        );
      }
    };

    const interval = setInterval(fetchRecyclersRealtime, 5000); // cada 5 segundos
    fetchRecyclersRealtime();
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleDelete = async (pointId: number) => {
    setIsDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCollectionPoint(pointId.toString());
      setSuccess('Punto de recolección eliminado con éxito');
      setCollectionPoints(collectionPoints.filter((point) => point.id !== pointId));
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
  const [editSchedule, setEditSchedule] = useState(user?.schedule || '');
  const [editNotas, setEditNotas] = useState('');
  // const [editDni, setEditDni] = useState(user?.dni || ''); // Si tienes campo dni

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
      <div className="flex items-center gap-4 mb-8 bg-white shadow rounded-lg px-6 py-4 w-full max-w-2xl">
        <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 border-2 border-green-600">
          <img
            src={avatarUrl}
            alt="Foto de perfil"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-700">{user?.name || 'Residente'}</h2>
          <p className="text-gray-500 capitalize">{user?.type === 'resident' ? 'Residente' : user?.type || 'Usuario'}</p>
        </div>
      </div>
      <h1 className="text-4xl font-extrabold text-green-700 mb-8">Panel de Residente</h1>
      <div className="flex space-x-4 mb-8">
        <button
          className={`px-4 py-2 rounded-md font-semibold ${activeTab === 'puntos' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setActiveTab('puntos')}
        >
          Mis Puntos de Recolección
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold ${activeTab === 'recicladores' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setActiveTab('recicladores')}
        >
          Recicladores
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold ${activeTab === 'perfil' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setActiveTab('perfil')}
        >
          Mi Perfil
        </button>
        <button
          className={`px-4 py-2 rounded-md font-semibold ${activeTab === 'historial' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setActiveTab('historial')}
        >
          Historial
        </button>
      </div>
      {activeTab === 'puntos' && (
        <div className="w-full max-w-4xl">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Mis Puntos de Recolección</h2>
            <Link to="/add-collection-point" className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700 mb-4">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Punto
            </Link>
            {collectionPoints.length === 0 ? (
              <p className="text-gray-500">No tienes puntos de recolección registrados.</p>
            ) : (
              <ul className="space-y-4">
                {collectionPoints.map((point) => (
                  <li
                    key={point.id}
                    className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center relative bg-white shadow-md transition-all duration-300 ease-in-out hover:scale-[1.025] hover:shadow-2xl group animate-fade-in"
                    style={{ animation: 'fadeInUp 0.7s' }}
                  >
                    <div className="flex-1 mb-2 md:mb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <img
                          src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png"
                          alt="Marcador"
                          className="w-12 h-12"
                        />
                        <h3 className="text-lg font-semibold whitespace-normal break-words">{point.address}</h3>
                      </div>
                      <p className="text-gray-500">
                        <MapPin className="inline-block w-4 h-4 mr-1" />
                        {point.district}
                      </p>
                      <p className="text-gray-500">
                        <Calendar className="inline-block w-4 h-4 mr-1" />
                        {point.schedule}
                      </p>
                      {point.notas && (
                        <p className="text-gray-600 mt-2 text-sm"><b>Notas adicionales:</b> {point.notas}</p>
                      )}
                    </div>
                    {/* GIF animado a la derecha */}
                    <div className="flex-shrink-0 flex margin rigth items-center md:ml-6 mt-4 md:mt-0">
                      <div className="transition-transform duration-300 hover:scale-110 hover:rotate-2 hover:shadow-green-300 hover:shadow-lg rounded-lg">
                        <img
                          src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1747453055/Reduce_Climate_Change_GIF_by_Bhumi_Pednekar_uazzk6.gif"
                          alt="Reduce Climate Change GIF"
                          className="w-40 h-28 object-contain rounded-lg shadow-md border border-green-200"
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
                        className="bg-red-500 text-white rounded-lg px-4 py-2 flex items-center overflow-hidden relative ripple-btn"
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Clock className="animate-spin h-5 w-5 mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <Map
              points={recyclers.filter(r => r.profiles?.avatar_url && r.profiles?.name && r.lat && r.lng && r.online !== false).map((rec) => ({
                id: rec.id.toString(),
                lat: rec.lat ?? 0, // Asegúrate de tener lat/lng en el modelo de reciclador
                lng: rec.lng ?? 0,
                title: rec.profiles?.name || 'Reciclador',
                avatar_url: rec.profiles?.avatar_url,
                isRecycler: true
              }))}
              showUserLocation={true}
            />
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
                  <h3 className="text-lg font-semibold text-green-700 mb-1">{rec.profiles?.name || 'Reciclador'}</h3>
                  <div className="flex items-center mb-1">
                    <Star className="h-5 w-5 text-yellow-400 mr-1" />
                    <span className="font-medium">{rec.rating_average?.toFixed(1) || '0.0'}</span>
                    <span className="ml-2 text-gray-400 text-sm">({rec.total_ratings || 0})</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-1 flex items-center"><Mail className="h-4 w-4 mr-1" />{rec.profiles?.email}</p>
                  {rec.profiles?.phone && <p className="text-gray-500 text-sm mb-1 flex items-center"><Phone className="h-4 w-4 mr-1" />{rec.profiles.phone}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {rec.materials?.map((mat: string, idx: number) => (
                      <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">{mat}</span>
                    ))}
                  </div>
                  {rec.bio && <p className="text-gray-600 text-xs mt-2 text-center">{rec.bio}</p>}
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
              // Guardar cambios en la base de datos
              const { error } = await supabase.from('profiles').update({
                name: editName,
                email: editEmail,
                phone: editPhone,
                address: editAddress,
                bio: editBio,
                materials: editMaterials.split(',').map((m) => m.trim()),
                schedule: editSchedule,
                // dni: editDni, // Si tienes campo dni
              }).eq('user_id', user?.id);
              if (!error) {
                setSuccess('Perfil actualizado correctamente');
              } else {
                setError('Error al actualizar el perfil');
              }
            }}
          >
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
                <img src={user?.avatar_url || avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              </div>
              <button type="button" className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Actualizar Foto</button>
            </div>
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
              {/* Si tienes campo dni, descomenta la siguiente línea */}
              {/* <div className="text-left">
                <label className="text-gray-600 text-sm">Número de DNI</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editDni} onChange={e => setEditDni(e.target.value)} />
              </div> */}
              <div className="text-left md:col-span-2">
                <label className="text-gray-600 text-sm">Nota</label>
                <textarea className="font-semibold w-full border rounded px-2 py-1" value={editBio} onChange={e => setEditBio(e.target.value)} />
              </div>
              <div className="text-left md:col-span-2">
                <label className="text-gray-600 text-sm">¿Qué le gusta reciclar?</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editMaterials} onChange={e => setEditMaterials(e.target.value)} placeholder="Ej: Papel, Plástico, Vidrio" />
              </div>
              <div className="text-left md:col-span-2">
                <label className="text-gray-600 text-sm">¿Desde cuándo recicla?</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editSchedule} onChange={e => setEditSchedule(e.target.value)} placeholder="Ej: 2020, Hace 3 años, etc." />
              </div>
              <div className="text-left md:col-span-2">
                <label className="text-gray-600 text-sm">Notas adicionales</label>
                <input className="font-semibold w-full border rounded px-2 py-1" value={editNotas} onChange={e => setEditNotas(e.target.value)} />
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
    </div>
  );
};

export default DashboardResident;
<style>{`
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
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
`}</style>
