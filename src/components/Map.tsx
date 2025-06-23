import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Marker, NavigationControl, MapRef, Layer, Source, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../lib/supabase';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const SANTIAGO_CENTER = {
  longitude: -64.2667,
  latitude: -27.7833,
  zoom: 13
};

export interface AdminZone {
  name: string;
  id?: string;
  coordinates: number[][][];
  color?: string;
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
  zones?: AdminZone[];
  showAdminZonesButton?: boolean;
  onMapClick?: (event: { lng: number; lat: number }) => void;
  disableDraw?: boolean;
  hideDrawControls?: boolean;
  showRoute?: boolean;
  route?: Array<{ lat: number; lng: number }>;

}

const MapboxPolygon: React.FC<MapboxPolygonProps> = ({
  markers = [],
  showUserLocation = false,
  zones = [],
  showAdminZonesButton = false,
  onMapClick,
  disableDraw = false,
  route = [],
}) => {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showAdminZones, setShowAdminZones] = useState(false);
  const [adminZones, setAdminZones] = useState<AdminZone[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<Array<{ lat: number; lng: number }>>([]);
  const [hoveredMarker, setHoveredMarker] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const mapRef = React.useRef<MapRef | null>(null);

  // Cargar zonas desde supabase
  const fetchAdminZones = useCallback(async () => {
    const { data, error } = await supabase.from('zones').select('*');
    if (!error && data) {
      const zonas: AdminZone[] = data.map((z: { id: string; name: string; coordinates: string | number[][][]; color?: string }) => {
        let coords: number[][][] | null = Array.isArray(z.coordinates) ? z.coordinates : null;
        if (typeof z.coordinates === 'string') {
          try { coords = JSON.parse(z.coordinates); } catch { coords = null; }
        }
        if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !Array.isArray(coords[0][0])) {
          coords = null;
        }
        return {
          id: z.id,
          name: z.name,
          coordinates: coords || [],
          color: z.color || undefined,
        };
      });
      setAdminZones(zonas);
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

  // Memoizar zonas a mostrar
  const zonasParaMostrar = useMemo(() => showAdminZones ? adminZones : zones, [showAdminZones, adminZones, zones]);

  // Handler para click en el mapa
  const handleMapClick = useCallback((event: mapboxgl.MapMouseEvent) => {
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
      {showAdminZonesButton && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <button
            onClick={async () => {
              if (!showAdminZones) await fetchAdminZones();
              setShowAdminZones((prev) => !prev);
            }}
            style={{
              background: showAdminZones ? '#22c55e' : '#fff',
              color: showAdminZones ? '#fff' : '#22c55e',
              border: '2px solid #22c55e',
              borderRadius: 8,
              padding: '8px 16px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
            }}
          >
            {showAdminZones ? 'Ocultar zonas' : 'Ver zonas del administrador'}
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
            <div className="w-10 h-10 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
          </Marker>
        )}
        {/* Marcadores personalizados */}
        {markers.map(marker => (
          <Marker key={marker.id} longitude={marker.lng} latitude={marker.lat}>
            <div
              style={{
                width: 40,
                height: 40,
                backgroundImage: `url(${marker.iconUrl || (marker.role === 'available' ? '/assets/Punto_de_Recoleccion_Verde.png' : '/assets/Punto_de_Recoleccion_Amarillo.png')})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                borderRadius: '50%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
              onMouseEnter={() => setHoveredMarker(marker)}
              onMouseLeave={() => setHoveredMarker(null)}
            />
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
        {zonasParaMostrar.map((zone) => (
          zone.coordinates && Array.isArray(zone.coordinates[0]) && Array.isArray(zone.coordinates[0][0]) && (
            <></>
          )
        ))}
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
    </div>
  );
};

export default MapboxPolygon;

// NOTA: Para evitar dobles refrescos, asegúrate de que las funciones que se pasan como props (onMapClick, onPolygonCreate, etc.) estén memoizadas con useCallback en el componente padre.