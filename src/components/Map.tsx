import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Marker, NavigationControl, MapRef, Layer, Source, Popup, MapMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../lib/supabase';
import { Zone } from '../types/supabase';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const SANTIAGO_CENTER = {
  longitude: -64.2667,
  latitude: -27.7833,
  zoom: 13
};

// Log para verificar configuración
if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN no está configurado');
} else {
  console.log('✅ MAPBOX_TOKEN configurado:', MAPBOX_TOKEN.substring(0, 10) + '...');
}

export interface MapboxPolygonProps {
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    avatar_url?: string;
    role?: string;
    online?: boolean;
    iconUrl?: string;
  }>;
  showUserLocation?: boolean;
  zones?: Zone[];
  showAdminZonesButton?: boolean;
  onMapClick?: (event: { lng: number; lat: number }) => void;
  disableDraw?: boolean;
  hideDrawControls?: boolean;
  showRoute?: boolean;
  route?: Array<{ lat: number; lng: number }>;
  // Permitir que el padre pida que el mapa haga fitBounds o que centre en la ubicación del usuario
  fitBounds?: [[number, number], [number, number]] | null;
  centerToUser?: boolean;

}

const MapboxPolygon: React.FC<MapboxPolygonProps> = ({
  markers = [],
  showUserLocation = false,
  zones = [],
  showAdminZonesButton = false,
  onMapClick,
  disableDraw = false,
  route = [],
  fitBounds = null,
  centerToUser = false,
}) => {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showAdminZones, setShowAdminZones] = useState(false);
  const [adminZones, setAdminZones] = useState<Zone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<Array<{ lat: number; lng: number }>>([]);
  const [hoveredMarker, setHoveredMarker] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const mapRef = React.useRef<MapRef | null>(null);

  // Cargar zonas desde supabase
  const fetchAdminZones = useCallback(async () => {
    setLoadingZones(true);
    setZonesError(null);
    
    try {
      console.log('🔍 Iniciando carga de zonas desde Supabase...');
      const { data, error } = await supabase.from('zones').select('*');
      
      if (error) {
        console.error('❌ Error cargando zonas:', error);
        setZonesError('Error al cargar las zonas de administrador');
        
        // Datos de prueba como fallback
        console.log('🔄 Usando datos de prueba...');
        const testZones: Zone[] = [
          {
            id: 'test-1',
            name: 'Zona Centro (Prueba)',
            coordinates: [
              [
                [-64.2667, -27.7833],
                [-64.2600, -27.7833],
                [-64.2600, -27.7900],
                [-64.2667, -27.7900],
                [-64.2667, -27.7833]
              ]
            ],
            color: '#22c55e',
            created_at: new Date().toISOString()
          },
          {
            id: 'test-2',
            name: 'Zona Norte (Prueba)',
            coordinates: [
              [
                [-64.2700, -27.7700],
                [-64.2600, -27.7700],
                [-64.2600, -27.7750],
                [-64.2700, -27.7750],
                [-64.2700, -27.7700]
              ]
            ],
            color: '#3b82f6',
            created_at: new Date().toISOString()
          }
        ];
        setAdminZones(testZones);
        console.log('✅ Cargadas zonas de prueba:', testZones);
        return;
      }
      
      console.log('📦 Datos recibidos de Supabase:', data);
      
      if (data && data.length > 0) {
        const zonas: Zone[] = data.map((z: { 
          id: string; 
          name: string; 
          coordinates: string | number[][][] | { type: string; features?: unknown[]; geometry?: unknown }; 
          color?: string; 
          created_at: string; 
          created_by?: string; 
          updated_at?: string;
        }) => {
          console.log(`🔧 Procesando zona: ${z.name}`);
          console.log(`🔍 Tipo de coordenadas:`, typeof z.coordinates);
          console.log(`📦 Estructura completa de coordenadas:`, z.coordinates);
          
          let coords: number[][][] = [];
          
          // Caso 1: Ya es un array de coordenadas
          if (Array.isArray(z.coordinates)) {
            coords = z.coordinates;
          } 
          // Caso 2: String JSON que necesita parsing
          else if (typeof z.coordinates === 'string') {
            try { 
              const parsed = JSON.parse(z.coordinates);
              coords = parsed;
              console.log(`✅ Coordenadas parseadas desde string para ${z.name}:`, coords);
            } catch (parseError) { 
              console.warn(`❌ Error parsing JSON string for zone ${z.id}:`, parseError);
              coords = [];
            }
          }
          // Caso 3: FeatureCollection de GeoJSON
          else if (z.coordinates && typeof z.coordinates === 'object' && (z.coordinates as { type?: string }).type === 'FeatureCollection') {
            try {
              console.log(`🗺️ Convirtiendo FeatureCollection para ${z.name}`);
              const featureCollection = z.coordinates as { features?: unknown[] };
              const features = featureCollection.features;
              
              console.log(`📋 Features encontrados:`, features);
              console.log(`🔢 Número de features:`, features?.length || 0);
              
              if (features && features.length > 0) {
                // Procesar todos los features, no solo el primero
                const extractedCoords: number[][][] = [];
                
                features.forEach((feature: unknown, index: number) => {
                  console.log(`🔎 Analizando feature ${index}:`, feature);
                  
                  const featureObj = feature as { geometry?: { type?: string; coordinates?: unknown } };
                  if (featureObj && featureObj.geometry) {
                    console.log(`📐 Geometría del feature ${index}:`, featureObj.geometry);
                    console.log(`📍 Tipo de geometría: ${featureObj.geometry.type}`);
                    console.log(`🎯 Coordenadas del feature:`, featureObj.geometry.coordinates);
                    
                    if (featureObj.geometry.type === 'Polygon') {
                      console.log(`🔺 Polígono encontrado en feature ${index}`);
                      const polygonCoords = featureObj.geometry.coordinates as number[][][];
                      if (polygonCoords && Array.isArray(polygonCoords)) {
                        console.log(`📊 Agregando coordenadas de polígono:`, polygonCoords);
                        // Asegurarse de que cada elemento es un array válido de coordenadas
                        polygonCoords.forEach(ring => {
                          if (Array.isArray(ring) && ring.length > 0) {
                            extractedCoords.push(ring);
                          }
                        });
                      }
                    } else if (featureObj.geometry.type === 'MultiPolygon') {
                      console.log(`🔺🔺 MultiPolígono encontrado en feature ${index}`);
                      const multiCoords = featureObj.geometry.coordinates as number[][][][];
                      if (Array.isArray(multiCoords)) {
                        multiCoords.forEach((polygon: number[][][], polyIndex: number) => {
                          console.log(`📊 Agregando polígono ${polyIndex}:`, polygon);
                          if (Array.isArray(polygon) && polygon.length > 0) {
                            polygon.forEach(ring => {
                              if (Array.isArray(ring) && ring.length > 0) {
                                extractedCoords.push(ring);
                              }
                            });
                          }
                        });
                      }
                    } else if (featureObj.geometry.type === 'Point') {
                      console.log(`📍 Punto encontrado en feature ${index}, convirtiendo a polígono circular`);
                      const pointCoords = featureObj.geometry.coordinates as [number, number];
                      if (pointCoords && Array.isArray(pointCoords) && pointCoords.length === 2) {
                        // Crear un polígono circular alrededor del punto
                        const [lng, lat] = pointCoords;
                        // Aumentamos el radio para que las áreas sean más visibles
                        const radius = 0.003; // Radio en grados (aproximadamente 300 metros)
                        const sides = 32; // Aumentamos el número de lados para un círculo más suave
                        const circleCoords: [number, number][] = [];
                        
                        for (let i = 0; i < sides; i++) {
                          const angle = (2 * Math.PI * i) / sides;
                          const x = lng + radius * Math.cos(angle);
                          const y = lat + radius * Math.sin(angle);
                          circleCoords.push([x, y] as [number, number]);
                        }
                        // Cerrar el polígono
                        circleCoords.push(circleCoords[0]);
                        
                        console.log(`🔴 Polígono circular creado con ${circleCoords.length} puntos:`, circleCoords);
                        extractedCoords.push(circleCoords);
                      }
                    } else {
                      console.log(`❓ Tipo de geometría no soportado: ${featureObj.geometry.type}`);
                    }
                  } else {
                    console.log(`❌ Feature ${index} no tiene geometría válida:`, feature);
                  }
                });
                
                coords = extractedCoords;
                console.log(`✅ Coordenadas extraídas de FeatureCollection para ${z.name}:`, coords);
                console.log(`🔢 Total de polígonos extraídos: ${coords.length}`);
              } else {
                console.log(`❌ Features no es un array válido o está vacío:`, features);
              }
            } catch (geoError) {
              console.warn(`❌ Error processing FeatureCollection for zone ${z.id}:`, geoError);
              coords = [];
            }
          }
          // Caso 4: Objeto con geometría directa
          else if (z.coordinates && typeof z.coordinates === 'object' && (z.coordinates as { geometry?: unknown }).geometry) {
            try {
              console.log(`🎯 Extrayendo geometría directa para ${z.name}`);
              const geometry = (z.coordinates as { geometry: { type?: string; coordinates?: unknown } }).geometry;
              if (geometry.type === 'Polygon' && geometry.coordinates) {
                coords = geometry.coordinates as number[][][];
              } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
                const multiCoords = geometry.coordinates as unknown;
                if (Array.isArray(multiCoords) && Array.isArray(multiCoords[0])) {
                  coords = multiCoords[0] as number[][][];
                }
              }
              console.log(`✅ Coordenadas extraídas de geometría para ${z.name}:`, coords);
            } catch (geomError) {
              console.warn(`❌ Error processing geometry for zone ${z.id}:`, geomError);
              coords = [];
            }
          }
          
          // Validar formato final
          if (!Array.isArray(coords) || coords.length === 0 || !Array.isArray(coords[0]) || !Array.isArray(coords[0][0])) {
            console.warn(`⚠️ Invalid coordinates format for zone ${z.id}`, coords);
            return null;
          }
          
          // Validar que las coordenadas son números válidos
          const isValidCoordinates = coords[0].every(coord => 
            Array.isArray(coord) && 
            coord.length === 2 && 
            typeof coord[0] === 'number' && 
            typeof coord[1] === 'number' &&
            !isNaN(coord[0]) && 
            !isNaN(coord[1])
          );
          
          if (!isValidCoordinates) {
            console.warn(`⚠️ Invalid coordinate values for zone ${z.id}`, coords[0]);
            return null;
          }
          
          const zona = {
            id: z.id,
            name: z.name,
            coordinates: coords,
            color: z.color || '#3B82F6',
            created_at: z.created_at,
            created_by: z.created_by,
            updated_at: z.updated_at
          };
          
          console.log(`✅ Zona procesada correctamente:`, zona.name, 'con', zona.coordinates[0].length, 'puntos');
          return zona;
        }).filter(Boolean) as Zone[];
        
        setAdminZones(zonas);
        console.log(`🎉 Cargadas ${zonas.length} zonas de administrador:`, zonas);
      } else {
        console.log('⚠️ No hay zonas en la base de datos, usando datos de prueba...');
        
        // Datos de prueba si no hay zonas en la BD
        const testZones: Zone[] = [
          {
            id: 'test-1',
            name: 'Zona Centro (Prueba)',
            coordinates: [
              [
                [-64.2667, -27.7833],
                [-64.2600, -27.7833],
                [-64.2600, -27.7900],
                [-64.2667, -27.7900],
                [-64.2667, -27.7833]
              ]
            ],
            color: '#22c55e',
            created_at: new Date().toISOString()
          }
        ];
        setAdminZones(testZones);
        console.log('✅ Cargadas zonas de prueba:', testZones);
      }
    } catch (error) {
      console.error('❌ Error fetching zones:', error);
      setZonesError('Error de conexión al cargar las zonas');
      
      // Datos de prueba como fallback
      const testZones: Zone[] = [
        {
          id: 'test-1',
          name: 'Zona Centro (Prueba)',
          coordinates: [
            [
              [-64.2667, -27.7833],
              [-64.2600, -27.7833],
              [-64.2600, -27.7900],
              [-64.2667, -27.7900],
              [-64.2667, -27.7833]
            ]
          ],
          color: '#22c55e',
          created_at: new Date().toISOString()
        }
      ];
      setAdminZones(testZones);
      console.log('🔄 Usando datos de prueba por error de conexión');
    } finally {
      setLoadingZones(false);
    }
  }, []);

  useEffect(() => {
    if (showUserLocation) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          () => {
            setLocationError('No se pudo obtener tu ubicación');
          }
        );
      } else {
        setLocationError('Tu navegador no soporta geolocalización');
      }
    }
  }, [showUserLocation]);

  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15,
        duration: 1000
      });
    }
  }, [userLocation]);

  // Efecto: si el padre solicita fitBounds, aplicar en el mapRef
  useEffect(() => {
    if (!mapRef.current) return;
    if (fitBounds) {
      try {
        const fb = fitBounds as [[number, number], [number, number]];
        if (fb && fb.length === 2 && mapRef.current) {
          mapRef.current.fitBounds(fb, { padding: 80, duration: 800 });
        }
      } catch (err) {
        console.warn('[Map] fitBounds failed:', err);
      }
    }
  }, [fitBounds]);

  // Efecto: si el padre pide centrar en la posición del usuario, solicitar geolocalización y volar allí
  useEffect(() => {
    if (!centerToUser) return;
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
        }
      },
      (err) => {
        console.warn('[Map] centerToUser geolocation failed:', err);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
    );
  }, [centerToUser]);

  // Memoizar zonas a mostrar
  const zonasParaMostrar = useMemo(() => {
    const result = showAdminZones ? adminZones : zones;
    console.log('🎭 Zonas para mostrar:', result);
    console.log('🎛️ showAdminZones:', showAdminZones);
    console.log('📊 adminZones:', adminZones);
    console.log('🏗️ zones prop:', zones);
    return result;
  }, [showAdminZones, adminZones, zones]);

  // Handler para click en el mapa
  const handleMapClick = useCallback((event: MapMouseEvent) => {
    if (onMapClick) {
      onMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    }
  }, [onMapClick]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchRoute = async (coordinates: any[]) => {
    const query = coordinates.map(coord => `${coord.lng},${coord.lat}`).join(';');
    const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${query}?geometries=geojson&access_token=${MAPBOX_TOKEN}`);
    const data = await response.json();
    return data.routes[0]?.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lng, lat }));
  };

  useEffect(() => {
    if (route && route.length > 1) {
      fetchRoute(route).then((optimizedRoute) => {
        setOptimizedRoute(optimizedRoute);
      });
    }
  }, [route]);

  return (
    <div style={{ width: '100%', height: 500, position: 'relative' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      {showAdminZonesButton && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <button
            onClick={async () => {
              if (showAdminZones) {
                // Solo ocultar las zonas
                console.log('🙈 Ocultando zonas');
                setShowAdminZones(false);
              } else {
                // Cargar y mostrar las zonas
                console.log('👁️ Mostrando zonas');
                await fetchAdminZones();
                setShowAdminZones(true);
              }
            }}
            disabled={loadingZones}
            style={{
              background: showAdminZones ? '#22c55e' : '#fff',
              color: showAdminZones ? '#fff' : '#22c55e',
              border: '2px solid #22c55e',
              borderRadius: 8,
              padding: '8px 16px',
              fontWeight: 700,
              cursor: loadingZones ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
              opacity: loadingZones ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '180px',
              justifyContent: 'center'
            }}
          >
            {loadingZones ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid currentColor',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Cargando...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"/>
                </svg>
                {showAdminZones ? 'Ocultar Zonas' : 'Ver Zonas Admin'}
              </>
            )}
          </button>
        </div>
      )}
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={SANTIAGO_CENTER}
        style={{ width: '100%', height: 500 }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        onClick={handleMapClick}
        cursor={disableDraw ? 'default' : 'crosshair'}
      >
        <NavigationControl position="top-right" />
        {/* Marcador de usuario */}
        {userLocation && (
          <Marker longitude={userLocation.longitude} latitude={userLocation.latitude}>
            <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </Marker>
        )}
        {/* Marcadores personalizados */}
        {markers.map(marker => (
          <Marker key={marker.id} longitude={marker.lng} latitude={marker.lat}>
            <div
              onMouseEnter={() => setHoveredMarker(marker)}
              onMouseLeave={() => setHoveredMarker(null)}
              style={{ position: 'relative', width: 80, height: 80, cursor: 'pointer' }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${marker.iconUrl ||
                    (marker.role === 'resident_institutional'
                      ? 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1750822947/iconmepresa_qbqqmx.png'
                      : marker.role === 'collection_point'
                      ? '/assets/recycling-marker.svg' // Icono para punto colectivo genérico
                      : marker.role === 'available'
                      ? '/assets/Punto_de_Recoleccion_Verde.png'
                      : '/assets/Punto_de_Recoleccion_Amarillo.png')})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              />
              {marker.avatar_url && (
                <img
                  src={marker.avatar_url}
                  alt="Avatar del reciclador"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '30px',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: '2px solid #fff',
                    zIndex: 2,
                    objectFit: 'cover',
                  }}
                />
              )}
              {/* Mostrar bicicleta grande DETRÁS del avatar (sin sombra) para que parezca que el avatar está montado */}
              {(marker.role === 'recycler' || marker.online) && (
                <img
                  src={'/assets/bicireciclador-Photoroom.png'}
                  alt="Bicicleta reciclador"
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '6px',
                    width: '56px',
                    height: '56px',
                    zIndex: 1,
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>
            {hoveredMarker?.id === marker.id && (
              <Popup
                longitude={marker.lng}
                latitude={marker.lat}
                closeButton={false}
                closeOnClick={false}
                anchor="top"
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>{marker.title}</div>
              </Popup>
            )}
          </Marker>
        ))}
        {/* Zonas como polígonos */}
        {zonasParaMostrar.map((zone, index) => {
          console.log(`🔍 Renderizando zona ${index}:`, zone);
          
          if (!zone.coordinates || !Array.isArray(zone.coordinates[0]) || !Array.isArray(zone.coordinates[0][0])) {
            console.warn(`⚠️ Zona ${zone.name} tiene coordenadas inválidas:`, zone.coordinates);
            return null;
          }
          
          const zoneId = zone.id || `zone-${index}`;
          const sourceId = `zone-source-${zoneId}`;
          const fillLayerId = `zone-fill-${zoneId}`;
          const strokeLayerId = `zone-stroke-${zoneId}`;
          
          console.log(`✅ Creando polígono para zona ${zone.name} con ID ${zoneId}`);
          
          // Comprobar si la zona proviene de un punto convertido a círculo
          const isCircle = zone.coordinates.length === 1 && 
                           zone.coordinates[0].length >= 16 && 
                           zone.coordinates[0].length <= 20; // Un círculo generalmente tiene entre 16-20 puntos
          
          return (
            <React.Fragment key={zoneId}>
              <Source 
                id={sourceId} 
                type="geojson" 
                data={{
                  type: 'Feature',
                  properties: {
                    name: zone.name,
                    id: zoneId,
                    color: zone.color || '#3B82F6',
                    isCircle: isCircle
                  },
                  geometry: {
                    type: 'Polygon',
                    coordinates: zone.coordinates
                  }
                }}
              >
                {/* Relleno del polígono */}
                <Layer
                  id={fillLayerId}
                  type="fill"
                  paint={{
                    'fill-color': zone.color || '#3B82F6',
                    'fill-opacity': isCircle ? 0.4 : 0.2, // Mayor opacidad para círculos
                    'fill-outline-color': zone.color || '#3B82F6'
                  }}
                />
                {/* Borde del polígono */}
                <Layer
                  id={strokeLayerId}
                  type="line"
                  paint={{
                    'line-color': zone.color || '#3B82F6',
                    'line-width': isCircle ? 3 : 2, // Línea más gruesa para círculos
                    'line-opacity': 0.8
                  }}
                />
              </Source>
            </React.Fragment>
          );
        })}
        {/* Ruta como línea */}
        {optimizedRoute && optimizedRoute.length > 1 && (
          <Source id="optimized-route" type="geojson" data={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: optimizedRoute.map(point => [point.lng, point.lat])
            }
          }}>
            <Layer
              id="optimized-route-layer"
              type="line"
              paint={{
                'line-color': '#3b82f6',
                'line-width': 8 // Incrementar el grosor de la línea
              }}
              layout={{
                'line-cap': 'round', // Hacer los extremos de la línea redondeados
                'line-join': 'round' // Hacer las esquinas de la línea redondeadas
              }}
            />
          </Source>
        )}
      </Map>
      {locationError && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-50 border-l-4 border-red-400 p-4 rounded shadow-md">
          <p className="text-sm text-red-700">{locationError}</p>
        </div>
      )}
      
      {zonesError && (
        <div className="absolute bottom-16 left-4 right-4 bg-red-50 border-l-4 border-red-400 p-4 rounded shadow-md">
          <p className="text-sm text-red-700">{zonesError}</p>
        </div>
      )}
      
      {showAdminZones && adminZones.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-blue-50 border-l-4 border-blue-400 p-3 rounded shadow-md">
          <p className="text-sm text-blue-700 font-medium">
            Mostrando {adminZones.length} zona{adminZones.length !== 1 ? 's' : ''} de administrador
          </p>
        </div>
      )}
    </div>
  );
};

export default MapboxPolygon;

// NOTA: Para evitar dobles refrescos, asegúrate de que las funciones que se pasan como props (onMapClick, onPolygonCreate, etc.) estén memoizadas con useCallback en el componente padre.