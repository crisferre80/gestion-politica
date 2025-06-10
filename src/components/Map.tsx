import React, { useEffect, useState, useRef } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Trash2 } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Santiago del Estero coordinates
const SANTIAGO_CENTER = {
  longitude: -64.2667,
  latitude: -27.7833,
  zoom: 13
};

interface MapComponentProps {
  points: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    avatar_url?: string;
    role?: string;
    online?: boolean;
  }>;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (event: { lng: number; lat: number }) => void;
  selectedLocation?: { lat: number; lng: number } | null;
  isAddingPoint?: boolean;
  showUserLocation?: boolean;
  showRoute?: boolean;
  routeDestination?: { lat: number; lng: number } | null;
  onDeletePoint?: (id: string) => void;
  // NUEVO: para rutas multipunto
  routePoints?: Array<{ lat: number; lng: number }>;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  points, 
  onMarkerClick,
  onMapClick,
  selectedLocation,
  isAddingPoint = false,
  showUserLocation = false,
  showRoute = false,
  routeDestination,
  onDeletePoint,
  routePoints // NUEVO
}) => {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number; latitude: number; longitude: number 
} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // Removed local routeDestination state to avoid duplicate identifier error

  useEffect(() => {
    if (showUserLocation) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });

            if (showRoute && routeDestination && position.coords) {
              drawRoute(
                [position.coords.longitude, position.coords.latitude],
                [routeDestination.lng, routeDestination.lat]
              );
            }
          },
          (error) => {
            console.error('Error getting location:', error);
            setLocationError('No se pudo obtener tu ubicación');
          }
        );
      } else {
        setLocationError('Tu navegador no soporta geolocalización');
      }
    }
  }, [showUserLocation, showRoute, routeDestination]);

  useEffect(() => {
    if (userLocation && routeDestination) {
      drawRoute(
        [userLocation.lng, userLocation.lat],
        [routeDestination.lng, routeDestination.lat]
      );
    }
  }, [userLocation, routeDestination]);

  const drawRoute = async (start: [number, number], end: [number, number]) => {
    try {
      if (mapRef.current) {
        // Remove existing route layer and source if they exist
        if (mapRef.current.getLayer('route')) {
          mapRef.current.removeLayer('route');
        }
        if (mapRef.current.getSource('route')) {
          mapRef.current.removeSource('route');
        }

        // Get route from Mapbox Directions API
        const query = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`,
          { method: 'GET' }
        );
        const json = await query.json();
        const data = json.routes[0];
        
        if (!data) {
          console.error('No route found');
          return;
        }

        // Add the route to the map
        mapRef.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: data.geometry
          }
        });

        mapRef.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#22c55e', // Green-600 from Tailwind
            'line-width': 4,
            'line-opacity': 0.75
          }
        });

        // Fit bounds to show the entire route
        const coordinates = data.geometry.coordinates;
        const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: number[]) => {
          return bounds.extend([coord[0], coord[1]]);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        mapRef.current.fitBounds(bounds, {
          padding: 50
        });
      }
    } catch (error) {
      console.error('Error drawing route:', error);
    }
  };

  const handleClick = (event: { lngLat: { lng: number; lat: number } }) => {
    if (onMapClick) {
      onMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    }
  };

  // Normalizar lat/lng a número y role/online
  const normalizedPoints = points.map((point) => ({
    ...point,
    lat: typeof point.lat === 'string' ? parseFloat(point.lat) : point.lat,
    lng: typeof point.lng === 'string' ? parseFloat(point.lng) : point.lng,
    role: point.role,
    online: String(point.online) === 'true' || String(point.online) === '1',
  }));

  // Filtrar puntos con coordenadas válidas
  const validPoints = normalizedPoints.filter(
    (point) =>
      typeof point.lat === 'number' &&
      typeof point.lng === 'number' &&
      !isNaN(point.lat) &&
      !isNaN(point.lng)
  );

  // Filtrar solo recicladores en línea por role y online
  const onlineRecyclers = validPoints.filter(
    (point) => point.role === 'recycler' && point.online === true
  );

  // Los puntos a mostrar: recicladores en línea o puntos normales
  const pointsToShow = onlineRecyclers.length > 0 ?
    [
      ...onlineRecyclers,
      ...validPoints.filter(p => p.role !== 'recycler')
    ] : validPoints;

  // --- CENTRAR MAPA EN RECICLADORES EN LÍNEA SI EXISTEN ---
  const [hasCentered, setHasCentered] = useState(false);
  useEffect(() => {
    if (onlineRecyclers.length > 0 && mapRef.current && !hasCentered) {
      const bounds = new mapboxgl.LngLatBounds();
      onlineRecyclers.forEach(r => {
        bounds.extend([r.lng, r.lat]);
      });
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
      setHasCentered(true);
    }
  }, [onlineRecyclers, mapRef, hasCentered]);
  // Permitir manipulación libre después de centrar
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setHasCentered(true);
    map.on('dragstart', onMove);
    map.on('zoomstart', onMove);
    return () => {
      map.off('dragstart', onMove);
      map.off('zoomstart', onMove);
    };
  }, [mapRef]);

  // --- DIBUJAR POLILÍNEA MULTIPUNTO SI routePoints ESTÁ PRESENTE ---
  useEffect(() => {
    if (!mapRef.current) return;
    // Generar un id único para la capa y source de la ruta
    const routeId = `route-polyline-${Date.now()}`;
    // Limpiar todas las capas y sources previas que empiecen con 'route-polyline-'
    const map = mapRef.current;
    const style = map.getStyle();
    if (style && style.layers) {
      style.layers.forEach(layer => {
        if (layer.id.startsWith('route-polyline-')) {
          if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        }
      });
    }
    const styleObj = map.getStyle();
    if (styleObj && styleObj.sources) {
      Object.keys(styleObj.sources).forEach(sourceId => {
        if (sourceId.startsWith('route-polyline-')) {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      });
    }
    if (routePoints && routePoints.length > 1) {
      const coordinates = routePoints.map(p => [p.lng, p.lat]);
      map.addSource(routeId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [...coordinates],
          },
        },
      });
      map.addLayer({
        id: routeId,
        type: 'line',
        source: routeId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#22c55e',
          'line-width': 4,
          'line-opacity': 0.75,
        },
      });
      // Centrar el mapa en la ruta
      if (coordinates.length > 1) {
        const bounds = new mapboxgl.LngLatBounds(
          coordinates[0] as [number, number],
          coordinates[0] as [number, number]
        );
        coordinates.forEach(coord => bounds.extend(coord as [number, number]));
        map.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [routePoints]);

  return (
    <div className="relative">
      <Map
        ref={(ref) => {
          if (ref) {
            mapRef.current = ref.getMap();
          }
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={SANTIAGO_CENTER}
        style={{ width: '100%', height: 400 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={handleClick}
        cursor={isAddingPoint ? 'crosshair' : 'default'}
      >
        <NavigationControl position="top-right" />
        {/* Solo mostrar la ubicación del usuario si no es un reciclador */}
        {userLocation && !points.some(p => p.role === 'recycler' && p.lat === userLocation.latitude && p.lng === userLocation.longitude) && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
          >
            <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
          </Marker>
        )}
        {/* Mostrar solo puntos válidos y recicladores en línea */}
        {pointsToShow.map((point) => (
          <Marker
            key={point.id}
            longitude={point.lng}
            latitude={point.lat}
            onClick={() => {
              if (onMarkerClick) onMarkerClick(point.id);
            }}
          >
            <div className="cursor-pointer transform -translate-x-1/2 -translate-y-1/2 relative flex flex-col items-center">
              {point.role === 'recycler' ? (
                <>
                  <img
                    src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1747537980/bicireciclador-Photoroom_ij5myq.png"
                    alt="Reciclador"
                    className="w-16 h-16 object-contain drop-shadow-lg z-0"
                  />
                  {point.avatar_url && (
                    <div className="w-12 h-12 rounded-full border-4 border-green-600 shadow-lg overflow-hidden z-10 absolute -top-4 left-1/2 -translate-x-1/2" style={{ background: '#fff' }}>
                      <img
                        src={point.avatar_url}
                        alt={point.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </>
              ) : point.avatar_url ? (
                <div className="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden">
                  <img 
                    src={point.avatar_url} 
                    alt={point.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <img
                  src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png"
                  alt="Punto de Recolección"
                  className="w-10 h-10 object-contain drop-shadow-lg"
                />
              )}
              {onDeletePoint && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePoint(point.id);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600 transition-colors"
                  title="Eliminar punto"
                >
                  <Trash2 className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
          </Marker>
        ))}

        {selectedLocation && (
          <Marker
            longitude={selectedLocation.lng}
            latitude={selectedLocation.lat}
          >
            {/* Usa el mismo marcador visual que los puntos de recolección */}
            <img
              src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png"
              alt="Punto de Recolección"
              className="w-10 h-10 object-contain drop-shadow-lg"
            />
          </Marker>
        )}
      </Map>
      
      {locationError && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-50 border-l-4 border-red-400 p-4 rounded shadow-md">
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
      )}
    </div>
  );
};

export default MapComponent;