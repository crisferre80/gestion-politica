import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Filter, Search, Plus, List, Map as MapIcon, Clock } from 'lucide-react';
import { useUser } from '../context/UserContext';
import Map from '../components/Map';
import { supabase, type CollectionPoint } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

function PuntosRecoleccion() {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [selectedPickupTime, setSelectedPickupTime] = useState<Date | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

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
        .order('created_at', { ascending: false })
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

  const handleClaimPoint = async (pointId: string) => {
    if (!user) {
      setError('Debes iniciar sesión para reclamar puntos de recolección');
      return;
    }

    if (!selectedPickupTime) {
      setError('Por favor selecciona una fecha y hora de recolección');
      return;
    }

    try {
      await supabase
        .from('collection_points')
        .update({ 
          status: 'claimed',
          recycler_id: user.id,
          claimed_at: new Date().toISOString()
        })
        .eq('id', pointId)
        .eq('status', 'available');

      // Update local state
      setCollectionPoints(points => points.filter(p => p.id !== pointId));
      setShowPickupModal(false);
      setSelectedPointId(null);
      setSelectedPickupTime(null);
      
      alert('Punto de recolección reclamado exitosamente');
    } catch (err) {
      console.error('Error claiming point:', err);
      setError('Error al reclamar el punto de recolección');
    }
  };

  const handleCancelClaim = async (pointId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('collection_points')
        .update({ status: 'available', claimed_by: null, pickup_time: null })
        .eq('id', pointId);

      if (error) throw error;

      setCollectionPoints(points =>
        points.map(p =>
          p.id === pointId
            ? { ...p, status: 'available', claimed_by: '', pickup_time: undefined }
            : p
        )
      );
      alert('Reclamación cancelada');
    } catch (err) {
      console.error('Error cancelando reclamación:', err);
      setError('Error al cancelar la reclamación');
    }
  };

  const toggleMaterial = (material: string) => {
    if (selectedMaterials.includes(material)) {
      setSelectedMaterials(selectedMaterials.filter(m => m !== material));
    } else {
      setSelectedMaterials([...selectedMaterials, material]);
    }
  };

  const filteredPoints = collectionPoints.filter(point => {
    const matchesSearch = 
      point.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      point.district.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMaterials = 
      selectedMaterials.length === 0 || 
      selectedMaterials.some(material => point.materials.includes(material));
    
    return matchesSearch && matchesMaterials;
  });

  const mapPoints = viewMode === 'map' ? filteredPoints.map(point => ({
    id: point.id,
    lat: Number(point.latitude),
    lng: Number(point.longitude),
    title: point.address,
    isRecycler: false
  })) : [];

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Puntos de Recolección</h1>
            <p className="text-gray-600 mt-1">
              Encuentra puntos de recolección cercanos o registra el tuyo
            </p>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-4">
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                  viewMode === 'list'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                  viewMode === 'map'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <MapIcon className="h-4 w-4" />
              </button>
            </div>
            
            {user && user.type === 'resident' && (
              <Link
                to="/add-collection-point"
                className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Punto
              </Link>
            )}
          </div>
        </div>

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

        {viewMode === 'map' ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <Map
              points={mapPoints}
              showUserLocation={true}
            />
          </div>
        ) : (
          <>
            {filteredPoints.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPoints.map((point) => (
                  <div key={point.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                      </div>
                      
                      <div className="mt-4 flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{point.schedule}</span>
                      </div>

                      {user && user.type === 'recycler' && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          {point.status === 'claimed' && point.claimed_by === user.id ? (
                            <button
                              onClick={() => handleCancelClaim(point.id)}
                              className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center justify-center"
                            >
                              Cancelar reclamación
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                setSelectedPointId(point.id);
                                setShowPickupModal(true);
                              }}
                              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Programar Recolección
                            </button>
                          )}
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
          </>
        )}
      </div>

      {showPickupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Seleccionar fecha y hora de recolección
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Cuándo pasarás a recoger?
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
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPickupModal(false);
                  setSelectedPointId(null);
                  setSelectedPickupTime(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => selectedPointId && handleClaimPoint(selectedPointId)}
                disabled={!selectedPickupTime}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PuntosRecoleccion;