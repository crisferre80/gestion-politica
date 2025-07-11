import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PhotoCapture from '../components/PhotoCapture';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '../context/UserContext';
import Map from '../components/Map';
import { supabase } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createNotification } from '../lib/notifications';
import { toast } from 'react-toastify';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface Suggestion {
  place_name: string;
  text: string;
  center?: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

const AddCollectionPoint: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  
  // Estado para verificar si está asociado a un punto colectivo
  const [isAssociatedToCollectivePoint, setIsAssociatedToCollectivePoint] = useState<boolean>(false);
  const [collectivePointInfo, setCollectivePointInfo] = useState<{ address: string; institutionalName: string } | null>(null);
  
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [bultos, setBultos] = useState<number>(1);
  const [collectionDate, setCollectionDate] = useState<Date | null>(null);
  const [collectionTimeStart, setCollectionTimeStart] = useState<Date | null>(null);
  const [collectionTimeEnd, setCollectionTimeEnd] = useState<Date | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<Suggestion[]>([]);
  const [districtSuggestions, setDistrictSuggestions] = useState<Suggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [showDistrictSuggestions, setShowDistrictSuggestions] = useState(false);

  const allMaterials = ['Papel', 'Cartón', 'Plástico', 'Vidrio', 'Metal', 'Electrónicos', 'Escombros'];
  // Estado para la foto del material (ahora con File y URL)
  const [materialPhotoFile, setMaterialPhotoFile] = useState<File | null>(null);
  const [materialPhotoPreview, setMaterialPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string>('');

  // Handler para PhotoCapture
  const handlePhotoCapture = async (file: File) => {
    setPhotoError('');
    // Reescalar a máximo 150 KB usando lógica similar a PhotoCapture
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        let dataUrl = '';
        for (let i = 0; i < 5; i++) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          const size = Math.round((dataUrl.length * 3) / 4 - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0));
          if (size <= 150 * 1024) break;
          quality -= 0.15;
          if (quality < 0.3) break;
        }
        const finalSize = Math.round((dataUrl.length * 3) / 4 - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0));
        if (finalSize > 150 * 1024) {
          setPhotoError('No se pudo reducir la imagen a menos de 150 KB. Usa una imagen más pequeña.');
          setMaterialPhotoFile(null);
          setMaterialPhotoPreview(null);
        } else {
          // Convertir a File
          const arr = dataUrl.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : '';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const newFile = new File([u8arr], `material-photo-${Date.now()}.jpg`, { type: mime });
          setMaterialPhotoFile(newFile);
          setMaterialPhotoPreview(dataUrl);
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchAddressSuggestions = async (query: string) => {
    if (!query) {
      setAddressSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ar&types=address&access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      setAddressSuggestions(data.features || []);
    } catch (err) {
      console.error('Error fetching address suggestions:', err);
    }
  };

  const fetchDistrictSuggestions = async (query: string) => {
    if (!query) {
      setDistrictSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ar&types=neighborhood,locality&access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      setDistrictSuggestions(data.features || []);
    } catch (err) {
      console.error('Error fetching district suggestions:', err);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    setShowAddressSuggestions(true);
    fetchAddressSuggestions(value);
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDistrict(value);
    setShowDistrictSuggestions(true);
    fetchDistrictSuggestions(value);
  };

  const handleAddressSuggestionClick = (suggestion: Suggestion) => {
    setAddress(suggestion.place_name);
    setShowAddressSuggestions(false);
    
    if (suggestion.center) {
      setSelectedLocation({ lng: suggestion.center[0], lat: suggestion.center[1] });
    }
    
    const districtContext = suggestion.context?.find(ctx => 
      ctx.id.startsWith('neighborhood') || ctx.id.startsWith('locality')
    );
    if (districtContext) {
      setDistrict(districtContext.text);
    }
  };

  const handleDistrictSuggestionClick = (suggestion: Suggestion) => {
    setDistrict(suggestion.text);
    setShowDistrictSuggestions(false);
  };

  const toggleMaterial = (material: string) => {
    if (materials.includes(material)) {
      setMaterials(materials.filter(m => m !== material));
    } else {
      setMaterials([...materials, material]);
    }
  };

  // Memoizar los markers para evitar renders innecesarios del mapa
  const mapMarkers = useMemo(() => {
    const markers = [];
    if (user?.lat && user?.lng) {
      markers.push({
        id: 'ubicacion-residente',
        lat: typeof user.lat === 'string' ? parseFloat(user.lat) : user.lat,
        lng: typeof user.lng === 'string' ? parseFloat(user.lng) : user.lng,
        title: 'Tu ubicación',
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
      });
    }
    if (selectedLocation) {
      markers.push({
        id: 'nuevo-punto',
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        title: 'Nuevo Punto de Recolección',
        iconUrl:
          user?.type === 'resident_institutional'
            ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750866292/Pcolectivo_fges4s.png'
            : 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png',
      });
    }
    return markers;
  }, [selectedLocation, user]);

  // Memoizar handleMapClick para evitar refrescos innecesarios del mapa
  const handleMapClick = useCallback((event: { lng: number; lat: number }) => {
    // No permitir clics en el mapa si está asociado a un punto colectivo
    if (isAssociatedToCollectivePoint) {
      return;
    }
    
    // Solo actualiza si la ubicación realmente cambió
    if (
      !selectedLocation ||
      selectedLocation.lat !== event.lat ||
      selectedLocation.lng !== event.lng
    ) {
      setSelectedLocation({ lat: event.lat, lng: event.lng });

      // Reverse geocoding
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${event.lng},${event.lat}.json?access_token=${MAPBOX_TOKEN}`
      )
        .then(response => response.json())
        .then(data => {
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            if (feature.place_name !== address) setAddress(feature.place_name);

            type ContextType = { id: string; text: string };
            const districtContext = feature.context?.find((ctx: ContextType) => 
              ctx.id.startsWith('neighborhood') || ctx.id.startsWith('locality')
            );
            if (districtContext && districtContext.text !== district) {
              setDistrict(districtContext.text);
            }
          }
        })
        .catch(err => {
          console.error('Error in reverse geocoding:', err);
        });
    }
  }, [selectedLocation, address, district, isAssociatedToCollectivePoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) { // Validar con el UID de Supabase
      setError('Debes iniciar sesión para agregar un punto de recolección');
      return;
    }
    
    if (!selectedLocation) {
      setError('Por favor selecciona una ubicación en el mapa');
      return;
    }
    
    // Validación condicional del distrito: no es obligatorio si está asociado a punto colectivo
    const districtRequired = !isAssociatedToCollectivePoint;
    if (!address || (districtRequired && !district) || materials.length === 0 || bultos < 1 || !collectionDate || !collectionTimeStart || !collectionTimeEnd) {
      if (!address) {
        setError('Por favor ingresa una dirección');
      } else if (districtRequired && !district) {
        setError('Por favor ingresa el distrito/zona');
      } else if (materials.length === 0) {
        setError('Por favor selecciona al menos un material');
      } else if (bultos < 1) {
        setError('La cantidad de bultos debe ser al menos 1');
      } else if (!collectionDate || !collectionTimeStart || !collectionTimeEnd) {
        setError('Por favor completa todos los campos de horario');
      }
      return;
    }
    
    setLoading(true);
    setError('');
    setPhotoError('');

    const formattedSchedule = `${format(collectionDate, 'EEEE')}s, ${format(collectionTimeStart, 'HH:mm')} - ${format(collectionTimeEnd, 'HH:mm')}`;

    // LOG DETALLADO PARA DEPURACIÓN
    console.log('DEBUG AddCollectionPoint: user:', user);
    console.log('DEBUG AddCollectionPoint: user.id (irá como user_id):', user?.id);
    console.log('DEBUG AddCollectionPoint: datos a insertar:', {
      user_id: user?.id,
      address,
      district,
      materials,
      bultos,
      schedule: formattedSchedule,
      additional_info: additionalInfo,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng
    });
    
    try {
      // Guardar la foto en la base de datos si existe
      let photoUrl: string | null = null;
      if (materialPhotoFile) {
        // Subir a Supabase Storage (bucket 'points' para fotos de puntos de recolección)
        const fileName = `photo_${user.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('points').upload(fileName, materialPhotoFile, { upsert: true });
        if (uploadError) {
          setPhotoError('No se pudo subir la foto.');
        } else {
          const { data: publicUrlData } = supabase.storage.from('points').getPublicUrl(fileName);
          photoUrl = publicUrlData?.publicUrl || null;
        }
      }

      const { error: supabaseError, data: newPoint } = await supabase
        .from('collection_points')
        .insert([
          {
            user_id: user.id, // Usar el UID de Supabase
            address,
            district,
            materials,
            bultos,
            schedule: formattedSchedule,
            additional_info: additionalInfo,
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            ...(user.type === 'resident_institutional' ? { type: 'colective_point' } : {}),
            photo_url: photoUrl
          }
        ])
        .select()
        .single();

      if (supabaseError) throw supabaseError;
      // Notificación para el residente (creador)
      try {
        await createNotification({
          user_id: user.id, // Notificar al UID correcto
          title: 'Punto de recolección creado',
          content: `Has creado un nuevo punto de recolección en ${address}.`,
          type: 'collection_point_created',
          related_id: newPoint?.id,
          user_name: user?.name,
          user_email: user?.email
        });
      } catch {
        toast.error('El punto se creó, pero no se pudo enviar la notificación al creador.');
      }
      // Notificación para todos los recicladores activos
      const { data: recyclers } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('role', 'recycler');
      if (recyclers && Array.isArray(recyclers)) {
        for (const recycler of recyclers) {
          try {
            await createNotification({
              user_id: recycler.user_id,
              title: 'Nuevo punto disponible',
              content: `Se ha creado un nuevo punto de recolección en ${address}.`,
              type: 'new_collection_point',
              related_id: newPoint?.id
              // No email/name for recicladores here
            });
          } catch {
            toast.error(`No se pudo notificar al reciclador (${recycler.user_id}).`);
          }
        }
      }
      // Navegación según el tipo de usuario
      navigate('/dashboard', { state: { refresh: true } });
    } catch (err) {
      console.error('Error:', err);
      setError('Ocurrió un error al crear el punto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowAddressSuggestions(false);
      setShowDistrictSuggestions(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Verificar si el residente está asociado a un punto colectivo
  useEffect(() => {
    async function checkCollectivePointAssociation() {
      if (!user?.id || !user?.address) {
        setIsAssociatedToCollectivePoint(false);
        setCollectivePointInfo(null);
        return;
      }

      // Buscar si existe un punto colectivo con la misma dirección del usuario
      const { data: collectivePoint, error } = await supabase
        .from('collection_points')
        .select(`
          id, 
          address, 
          type,
          lat,
          lng,
          profiles!collection_points_user_id_fkey(name)
        `)
        .eq('address', user.address)
        .eq('type', 'colective_point')
        .single();

      if (!error && collectivePoint) {
        setIsAssociatedToCollectivePoint(true);
        const profileData = Array.isArray(collectivePoint.profiles) 
          ? collectivePoint.profiles[0] 
          : collectivePoint.profiles;
        setCollectivePointInfo({
          address: collectivePoint.address,
          institutionalName: profileData?.name || 'Institución'
        });
        
        // Bloquear la dirección y ubicación del punto colectivo
        setAddress(collectivePoint.address);
        if (collectivePoint.lat && collectivePoint.lng) {
          setSelectedLocation({
            lat: Number(collectivePoint.lat),
            lng: Number(collectivePoint.lng)
          });
        }
        
        // Extraer el distrito de la dirección usando geocoding reverso
        if (collectivePoint.lat && collectivePoint.lng) {
          fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${collectivePoint.lng},${collectivePoint.lat}.json?access_token=${MAPBOX_TOKEN}`
          )
            .then(response => response.json())
            .then(data => {
              if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                type ContextType = { id: string; text: string };
                
                // Intentar extraer distrito de diferentes contextos (orden de prioridad)
                const districtContext = feature.context?.find((ctx: ContextType) => 
                  ctx.id.startsWith('neighborhood') || 
                  ctx.id.startsWith('locality') ||
                  ctx.id.startsWith('place') ||
                  ctx.id.startsWith('district')
                );
                
                if (districtContext) {
                  setDistrict(districtContext.text);
                } else {
                  // Si no se encuentra en el contexto, usar parte de la dirección
                  const addressParts = collectivePoint.address.split(',');
                  if (addressParts.length > 1) {
                    setDistrict(addressParts[addressParts.length - 2].trim());
                  } else {
                    setDistrict('Centro'); // Valor por defecto
                  }
                }
              }
            })
            .catch(err => {
              console.error('Error in reverse geocoding for collective point:', err);
              // Fallback: extraer de la dirección
              const addressParts = collectivePoint.address.split(',');
              if (addressParts.length > 1) {
                setDistrict(addressParts[addressParts.length - 2].trim());
              } else {
                setDistrict('Centro');
              }
            });
        }
      } else {
        setIsAssociatedToCollectivePoint(false);
        setCollectivePointInfo(null);
      }
    }

    checkCollectivePointAssociation();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Debes iniciar sesión para agregar un punto de recolección</p>
          <Link to="/login" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center text-green-600 hover:text-green-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al panel
        </Link>
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-green-600 text-white p-6">
            <h1 className="text-2xl font-bold">Agregar Punto de Recolección</h1>
            <p className="text-green-100 mt-1">
              Registra un nuevo punto donde los recicladores pueden recoger tus materiales reciclables
            </p>
          </div>
          
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Aviso para residentes asociados a punto colectivo */}
            {isAssociatedToCollectivePoint && collectivePointInfo && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Punto asociado a colectivo
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Estás asociado al punto colectivo gestionado por <strong>{collectivePointInfo.institutionalName}</strong>. 
                        La dirección de tus nuevos puntos se establecerá automáticamente en: <strong>{collectivePointInfo.address}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isAssociatedToCollectivePoint 
                    ? 'Ubicación del punto colectivo (bloqueada)' 
                    : 'Selecciona la ubicación en el mapa'} 
                  <span className="text-red-500">*</span>
                </label>
                <Map
                  markers={mapMarkers}
                  onMapClick={handleMapClick}
                  disableDraw={true}      // Fuerza desactivar lógica de dibujo
                  showUserLocation={true}
                />
                {isAssociatedToCollectivePoint && (
                  <p className="text-sm text-gray-600 mt-2">
                    La ubicación está establecida automáticamente en la dirección del punto colectivo.
                  </p>
                )}
              </div>

              <div className="relative">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Dirección <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={handleAddressChange}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isAssociatedToCollectivePoint) {
                      setShowAddressSuggestions(true);
                    }
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Ej: Av. Siempreviva 742"
                  disabled={isAssociatedToCollectivePoint} // Deshabilitar si está asociado a un punto colectivo
                />
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg">
                    <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {addressSuggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddressSuggestionClick(suggestion);
                          }}
                        >
                          {suggestion.place_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <label htmlFor="district" className="block text-sm font-medium text-gray-700">
                  Distrito/Zona {!isAssociatedToCollectivePoint && <span className="text-red-500">*</span>}
                  {isAssociatedToCollectivePoint && <span className="text-gray-500">(automático)</span>}
                </label>
                <input
                  type="text"
                  id="district"
                  value={district}
                  onChange={handleDistrictChange}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isAssociatedToCollectivePoint) {
                      setShowDistrictSuggestions(true);
                    }
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder={isAssociatedToCollectivePoint ? "Se completará automáticamente" : "Ej: Centro"}
                  disabled={isAssociatedToCollectivePoint} // Deshabilitar si está asociado a un punto colectivo
                />
                {showDistrictSuggestions && districtSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg">
                    <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {districtSuggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDistrictSuggestionClick(suggestion);
                          }}
                        >
                          {suggestion.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isAssociatedToCollectivePoint && (
                  <p className="text-sm text-gray-600 mt-2">
                    El distrito se extraerá automáticamente de la ubicación del punto colectivo.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materiales para reciclar <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {allMaterials.map((material) => (
                    <button
                      key={material}
                      type="button"
                      onClick={() => toggleMaterial(material)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        materials.includes(material)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {material}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label htmlFor="bultos" className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad de bultos <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setBultos(Math.max(1, bultos - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-green-600 text-white rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md transition-all duration-200 active:scale-95"
                    disabled={bultos <= 1}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  
                  <div className="flex-1 max-w-24">
                    <input
                      type="number"
                      id="bultos"
                      min="1"
                      max="50"
                      value={bultos}
                      onChange={(e) => setBultos(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="w-full text-center border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm font-semibold text-lg"
                      placeholder="1"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setBultos(Math.min(50, bultos + 1))}
                    className="w-10 h-10 flex items-center justify-center bg-green-600 text-white rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md transition-all duration-200 active:scale-95"
                    disabled={bultos >= 50}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 text-center">
                  Número de bultos o bolsas de materiales reciclables (mínimo 1, máximo 50)
                </p>

                {/* Botón tomar foto o seleccionar archivo, igual que en perfil/header */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foto del material (opcional, máx. 150 KB)
                  </label>
                  <PhotoCapture
                    aspectRatio="square"
                    enableTransformations={true}
                    enableCropping={true}
                    onCapture={handlePhotoCapture}
                    onCancel={() => {}}
                    facingMode="environment"
                  />
                  {photoError && <p className="text-sm text-red-600 mb-2">{photoError}</p>}
                  {materialPhotoPreview && (
                    <div className="mb-2">
                      <img src={materialPhotoPreview} alt="Foto del material" className="max-h-40 rounded shadow" />
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horario de recolección <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Día</label>
                    <DatePicker
                      selected={collectionDate}
                      onChange={(date) => setCollectionDate(date)}
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      placeholderText="Seleccionar día"
                      dateFormat="EEEE"
                      showPopperArrow={false}
                      locale={es}
                      calendarStartDay={1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Hora inicio</label>
                    <div className="flex gap-2">
                      <select
                        className="border border-gray-300 rounded-md shadow-sm py-2 px-2 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm w-1/2"
                        value={collectionTimeStart ? collectionTimeStart.getHours() : ''}
                        onChange={e => {
                          const hour = parseInt(e.target.value);
                          const date = collectionTimeStart ? new Date(collectionTimeStart) : new Date();
                          date.setHours(hour);
                          setCollectionTimeStart(date);
                        }}
                      >
                        <option value="">Hora</option>
                        {[...Array(24)].map((_, h) => (
                          <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        className="border border-gray-300 rounded-md shadow-sm py-2 px-2 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm w-1/2"
                        value={collectionTimeStart ? collectionTimeStart.getMinutes() : ''}
                        onChange={e => {
                          const min = parseInt(e.target.value);
                          const date = collectionTimeStart ? new Date(collectionTimeStart) : new Date();
                          date.setMinutes(min);
                          setCollectionTimeStart(date);
                        }}
                      >
                        <option value="">Min</option>
                        {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                          <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Hora fin</label>
                    <div className="flex gap-2">
                      <select
                        className="border border-gray-300 rounded-md shadow-sm py-2 px-2 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm w-1/2"
                        value={collectionTimeEnd ? collectionTimeEnd.getHours() : ''}
                        onChange={e => {
                          const hour = parseInt(e.target.value);
                          const date = collectionTimeEnd ? new Date(collectionTimeEnd) : new Date();
                          date.setHours(hour);
                          setCollectionTimeEnd(date);
                        }}
                      >
                        <option value="">Hora</option>
                        {[...Array(24)].map((_, h) => (
                          <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        className="border border-gray-300 rounded-md shadow-sm py-2 px-2 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm w-1/2"
                        value={collectionTimeEnd ? collectionTimeEnd.getMinutes() : ''}
                        onChange={e => {
                          const min = parseInt(e.target.value);
                          const date = collectionTimeEnd ? new Date(collectionTimeEnd) : new Date();
                          date.setMinutes(min);
                          setCollectionTimeEnd(date);
                        }}
                      >
                        <option value="">Min</option>
                        {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                          <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-700">
                  Información adicional
                </label>
                <textarea
                  id="additionalInfo"
                  rows={4}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="Instrucciones especiales, referencias para ubicar el lugar, etc."
                />
              </div>
              
              <div className="flex justify-end">
                <Link
                  to="/dashboard"
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCollectionPoint;