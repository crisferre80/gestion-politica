import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Filter, Search, Plus } from 'lucide-react';
import { useUser } from '../context/UserContext';
import Map from '../components/Map';
import { supabase, type CollectionPoint } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

function PuntosRecoleccion() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPickupTime, setSelectedPickupTime] = useState<Date | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupExtra, setPickupExtra] = useState('');
  type ActiveClaim = { collection_point_id: string; status: string };
  const [claims, setClaims] = useState<ActiveClaim[]>([]);

  const allMaterials = ['Papel', 'Cartón', 'Plástico', 'Vidrio', 'Metal', 'Electrónicos'];

  const fetchPoints = React.useCallback(async () => {
    try {
      let query = supabase
        .from('collection_points')
        .select(`
          *,
          profiles!collection_points_user_id_fkey(
            name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false }) // OK: solo columna raíz
        .eq('status', 'available');

      if (user && user.type === 'recycler') {
        query = query.or(`status.eq.available,status.eq.claimed.and(claimed_by.eq.${user.id})`);
      } 

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      setCollectionPoints(data.map(point => ({
        ...point,
        creator_name: point.profiles?.name || 'Usuario Anónimo',
        creator_email: point.profiles?.email,
        creator_phone: point.profiles?.phone,
        status: point.status || 'available'
      })));
    } catch (err) {
      console.error('Error fetching collection points:', err);
      setError('Error al cargar los puntos de recolección');
    } finally {
      setLoading(false);
    }
  }, [user, setError]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // Cargar claims activos para los puntos disponibles
  useEffect(() => {
    const fetchClaims = async () => {
      const pointIds = collectionPoints.map(p => p.id);
      if (pointIds.length === 0) {
        setClaims([]);
        return;
      }
      const { data, error } = await supabase
        .from('collection_claims')
        .select('collection_point_id, status')
        .in('collection_point_id', pointIds);
      if (!error && data) setClaims(data);
      else setClaims([]);
    };
    fetchClaims();
  }, [collectionPoints]);

  // Función para eliminar un punto de recolección
  const handleDeletePoint = async (pointId: string) => {
    if (!user) {
      setError('Debes iniciar sesión para eliminar puntos de recolección');
      return;
    }
    if (!window.confirm('¿Estás seguro de que deseas eliminar este punto de recolección?')) {
      return;
    }
    try {
      await import('../lib/supabase').then(mod => mod.deleteCollectionPoint(pointId, user.id));
      await fetchPoints();
      alert('Punto de recolección eliminado exitosamente');
    } catch (err) {
      console.error('Error eliminando punto:', err);
      setError('Error al eliminar el punto de recolección');
    }
  };


  const toggleMaterial = (material: string) => {
    if (selectedMaterials.includes(material)) {
      setSelectedMaterials(selectedMaterials.filter(m => m !== material));
    } else {
      setSelectedMaterials([...selectedMaterials, material]);
    }
  };

  // Filtrar puntos que no tienen claim activo
  const filteredPoints = collectionPoints.filter(point => {
    const matchesSearch =
      point.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      point.district.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMaterials =
      selectedMaterials.length === 0 ||
      selectedMaterials.some(material => point.materials.includes(material));

    // Excluir puntos con claim activo (claimed o completed)
    const claim = claims.find(c => c.collection_point_id === point.id && (c.status === 'claimed' || c.status === 'completed'));
    return matchesSearch && matchesMaterials && !claim;
  });

  // Para el mapa, todos los puntos filtrados
  const mapPoints = filteredPoints.map(point => ({
    id: point.id,
    lat: Number(point.lat),
    lng: Number(point.lng),
    title: point.address,
    isRecycler: false
  }));

  
  return (
    <div className="bg-gray-50 min-h-screen py-8 relative bg-[url('https://res.cloudinary.com/dhvrrxejo/image/upload/v1748456546/reciclaje_fondo_rj36fm.jpg')] bg-cover bg-center bg-no-repeat">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Botón volver al Panel del reciclador (ahora dentro y arriba del título, con margen inferior en mobile) */}
        <div className="w-full flex justify-end md:justify-end mb-4 md:mb-0">
          <button
            onClick={() => {
              if (user?.type === 'recycler') {
                navigate('/dashboard-recycler', { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
            }}
            className="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-md flex items-center gap-2 shadow-lg transition-colors border border-green-200 md:static md:mt-0 mt-2"
            style={{ position: 'static' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {user?.type === 'recycler' ? 'Panel Reciclador' : 'Panel Residente'}
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-green-700 animate-bounce drop-shadow-lg tracking-wide bg-white/70 px-4 py-2 rounded-lg shadow-md">
              Puntos de Recolección
            </h1>
            <p className="text-gray-700 mt-2 bg-white/60 rounded px-2 py-1 shadow-sm">
              Encuentra puntos de recolección cercanos o registra el tuyo
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-4">
            {user && user.type === 'resident' && (
              <Link
                to="/add-collection-point"
                className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700 shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Punto
              </Link>
            )}
          </div>
        </div>

        {/* Explicación del mapa */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-green-100">
          <h2 className="text-lg font-semibold text-green-700 mb-2 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-green-500" />
            Mapa de puntos de recolección
          </h2>
          <p className="text-gray-700 mb-2">
            Aquí puedes ver todos los puntos de recolección creados por los residentes de la provincia. Haz zoom o mueve el mapa para explorar los diferentes puntos disponibles.
          </p>
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <Map
              points={mapPoints}
              showUserLocation={true}
            />
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por dirección o distrito..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </button>
          </div>
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por materiales:</h3>
              <div className="flex flex-wrap gap-2">
                {allMaterials.map((material) => (
                  <button
                    key={material}
                    onClick={() => toggleMaterial(material)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedMaterials.includes(material)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {material}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lista de puntos disponibles */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">Puntos de Recolección Disponibles</h2>
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 mb-4">Cargando puntos de recolección...</p>
          </div>
        ) : filteredPoints.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPoints.map(point => (
              <div key={point.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 text-green-500 mr-2 mt-1" />
                      <div>
                        <h3 className="font-medium text-gray-900">{point.address}</h3>
                        <p className="text-sm text-gray-500">
                          Materiales: {point.materials.join(', ')}
                        </p>
                      </div>
                    </div>
                    {/* Botón eliminar solo para el creador */}
                    {user && user.id === point.user_id && (
                      <button
                        onClick={() => handleDeletePoint(point.id)}
                        className="ml-2 text-red-600 hover:text-red-800"
                        title="Eliminar punto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>{point.schedule}</span>
                  </div>
                  {typeof point.additional_info === 'string' && point.additional_info.trim() !== '' && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Información adicional:</strong> {point.additional_info}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 mb-4">No se encontraron puntos de recolección con los filtros seleccionados.</p>
            {user && user.type === 'resident' && (
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

        {/* Modal de programación de recolección */}
        {showPickupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Programar recolección
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona fecha y hora para la recolección
                </label>
                <DatePicker
                  selected={selectedPickupTime}
                  onChange={(date) => setSelectedPickupTime(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={30}
                  dateFormat="MMMM d, yyyy h:mm aa"
                  minDate={new Date()}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholderText="Selecciona fecha y hora"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Información adicional (opcional)
                </label>
                <textarea
                  value={pickupExtra}
                  onChange={e => setPickupExtra(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Ejemplo: Instrucciones para el recolector, referencias, etc."
                  rows={2}
                />
              </div>
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-2 mb-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPickupModal(false);
                    setSelectedPickupTime(null);
                    setPickupExtra('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!selectedPickupTime) {
                      setError('Por favor selecciona una fecha y hora de recolección');
                      return;
                    }
                    try {
                      // Lógica para programar recolección eliminada
                      setShowPickupModal(false);
                      setSelectedPickupTime(null);
                      setPickupExtra('');
                      alert('Recolección programada exitosamente');
                      await fetchPoints();
                    } catch (err) {
                      console.error('Error al programar recolección:', err);
                      setError('Error al programar la recolección');
                    }
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700"
                >
                  Confirmar Recolección
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PuntosRecoleccion;