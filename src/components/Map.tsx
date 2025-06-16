import React, { useEffect, useRef, useState } from 'react';
import mapboxgl, { Map } from 'mapbox-gl';
import MapboxDraw, { DrawCreateEvent } from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { supabase } from '../lib/supabase';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiY3Jpc2ZlcnJlODAiLCJhIjoiY204MjliczYxMWhyZjJ0cTFrMWdldzMzMiJ9.Etd51sVEYQ1gyle4WN6PCQ';

interface AdminZone {
  name: string;
  id?: string;
  coordinates: number[][][]; // GeoJSON Polygon coordinates
  color?: string;
}

export interface MapboxPolygonProps {
  onPolygonCreate?: (feature: GeoJSON.Feature) => void;
  onSelectZone?: (id: string) => void;
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
  // Alias para markers (para compatibilidad con 'points')
  // points?: Array<{
  //   id: string;
  //   lat: number;
  //   lng: number;
  //   title: string;
  //   avatar_url?: string;
  //   role?: string;
  //   online?: boolean;
  //   iconUrl?: string;
  // }>;
  showUserLocation?: boolean;
  zones?: AdminZone[];
  hideDrawControls?: boolean;
  showAdminZonesButton?: boolean;
  // NUEVAS PROPS PARA RUTAS
  route?: { lat: number; lng: number }[];
  showRoute?: boolean;
  onMapClick?: (event: { lng: number; lat: number }) => void;
}

const MapboxPolygon: React.FC<MapboxPolygonProps> = ({
  onPolygonCreate,
  onSelectZone,
  markers = [],
  showUserLocation = false,
  zones = [],
  hideDrawControls = false,
  showAdminZonesButton = false,
  route = [],
  showRoute = false,
  onMapClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const zoneLayersRef = useRef<string[]>([]);

  // Estado para zonas del admin
  const [adminZones, setAdminZones] = useState<AdminZone[]>([]);
  const [showAdminZones, setShowAdminZones] = useState(false);

  // Función para cargar zonas desde la tabla 'zones'
  const fetchAdminZones = async () => {
    const { data, error } = await supabase.from('zones').select('*');
    if (!error && data) {
      console.log('Zonas obtenidas de supabase:', data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zonas: AdminZone[] = data.map((z: { id: string; name: any; coordinates: any; color?: string }) => {
        let coords = z.coordinates;
        if (typeof coords === 'string') {
          try { coords = JSON.parse(coords); } catch (e) { console.error('Error parseando coordinates', coords, e); coords = null; }
        }
        // Validar que sea un array de arrays de arrays de números
        if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !Array.isArray(coords[0][0])) {
          console.error('Formato de coordinates inválido para zona', z.id, coords);
          coords = null;
        }
        return {
          id: z.id,
          name: z.name,
          coordinates: coords,
          color: z.color || undefined,
        };
      });
      setAdminZones(zonas);
    } else {
      console.error('Error obteniendo zonas de supabase', error);
    }
  };

  // Función para limpiar capas de zonas del mapa
  const clearZoneLayers = () => {
    if (mapRef.current) {
      zoneLayersRef.current.forEach(id => {
        try {
          if (mapRef.current!.getLayer(id)) mapRef.current!.removeLayer(id);
          if (mapRef.current!.getSource(id)) mapRef.current!.removeSource(id);
        } catch { /* empty */ }
      });
      zoneLayersRef.current = [];
    }
  };

  // useEffect para recargar el mapa cuando cambian las zonas del admin
  useEffect(() => {
    // No hacer nada, el render del mapa ya depende de zones
  }, [adminZones, showAdminZones]);

  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    if (!mapContainerRef.current) return;
    // Centrar el mapa en la primera zona si existe
    let initialCenter: [number, number] = [-64.2667, -27.7833];
    let initialZoom = 13;
    if (zones && zones.length > 0 && zones[0].coordinates && zones[0].coordinates[0] && Array.isArray(zones[0].coordinates[0][0]) && zones[0].coordinates[0][0].length === 2) {
      initialCenter = [
        zones[0].coordinates[0][0][0],
        zones[0].coordinates[0][0][1]
      ];
      initialZoom = 15;
    }
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: initialCenter,
      zoom: initialZoom
    });

    // Geolocalización automática si showUserLocation está activo
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          mapRef.current!.flyTo({ center: [longitude, latitude], zoom: 15 });
          if (userMarkerRef.current) userMarkerRef.current.remove();
          userMarkerRef.current = new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat([longitude, latitude])
            .addTo(mapRef.current!);
        },
        () => {
          // Si el usuario no da permiso, no hacer nada
        },
        { enableHighAccuracy: true }
      );
    }

    // Manejar click en el mapa para seleccionar ubicación
    if (onMapClick) {
      mapRef.current.on('click', (e) => {
        onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });
    }

    if (!hideDrawControls) {
      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'draw_polygon'
      });
      mapRef.current.addControl(drawRef.current);
      mapRef.current.on('draw.create', (e: DrawCreateEvent) => {
        if (onPolygonCreate && e.features && e.features[0]) {
          onPolygonCreate(e.features[0]);
        }
      });
    }
    mapRef.current.on('load', () => {
      // Limpiar marcadores previos
      // ...no hay lógica previa para limpiar, pero si se requiere, agregar aquí...
      // Agregar marcadores personalizados
      markers.forEach(marker => {
        const el = document.createElement('div');
        el.style.width = '48px';
        el.style.height = '48px';
        el.style.backgroundImage = `url(${marker.iconUrl || '/assets/Punto de Recoleccion Marcador.png'})`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        el.title = marker.title;
        new mapboxgl.Marker(el)
          .setLngLat([marker.lng, marker.lat])
          .addTo(mapRef.current!);
      });
      // Limpiar capas de zonas antes de agregar nuevas
      clearZoneLayers();
      // Mostrar zonas del administrador
      const zonasParaMostrar = showAdminZones ? adminZones : zones;
      zonasParaMostrar.forEach((zone, idx) => {
        if (!zone || !zone.coordinates) return;
        let coords = zone.coordinates;
        if (typeof coords === 'string') {
          try { coords = JSON.parse(coords); } catch (e) { console.error('Error parseando coordinates', coords, e); return; }
        }
        // Validar que sea un array de arrays de arrays de números
        if (!Array.isArray(coords) || !Array.isArray(coords[0]) || !Array.isArray(coords[0][0])) {
          console.error('Formato de coordinates inválido para zona', zone.id, coords);
          return;
        }
        const id = `admin-zone-${idx}`;
        try {
          mapRef.current!.addSource(id, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: coords,
              },
              properties: { id: zone.id, name: zone.name },
            },
          });
          mapRef.current!.addLayer({
            id: id,
            type: 'fill',
            source: id,
            layout: {},
            paint: {
              'fill-color': zone.color || '#3b82f6',
              'fill-opacity': 0.35, // Más transparente
            },
          });
          mapRef.current!.addLayer({
            id: `${id}-border`,
            type: 'line',
            source: id,
            layout: {},
            paint: {
              'line-color': zone.color || '#3b82f6',
              'line-width': 2,
            },
          });
          // Agregar label con el nombre de la zona
          mapRef.current!.addLayer({
            id: `${id}-label`,
            type: 'symbol',
            source: id,
            layout: {
              'text-field': zone.name || 'Zona',
              'text-size': 14,
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#222',
              'text-halo-color': '#fff',
              'text-halo-width': 2,
            },
          });
          zoneLayersRef.current.push(id, `${id}-border`, `${id}-label`);
          if (onSelectZone) {
            mapRef.current!.on('click', id, (e) => {
              const feature = e.features && e.features[0];
              const zoneId = feature && feature.properties && feature.properties.id;
              if (zoneId) onSelectZone(zoneId);
            });
          }
        } catch (err) {
          console.error('Error agregando zona al mapa', err);
        }
      });
      // Mostrar ubicación del usuario si se solicita
      if (showUserLocation && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude, longitude } = pos.coords;
          if (userMarkerRef.current) userMarkerRef.current.remove();
          mapRef.current!.flyTo({ center: [longitude, latitude], zoom: 14 });
        });
      }
      // DIBUJAR RUTA SI SE SOLICITA
      if (showRoute && route && route.length >= 2) {
        const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.map(p => [p.lng, p.lat]),
          },
          properties: {},
        };
        if (mapRef.current!.getSource('route-line')) {
          (mapRef.current!.getSource('route-line') as mapboxgl.GeoJSONSource).setData(routeGeoJson);
        } else {
          mapRef.current!.addSource('route-line', {
            type: 'geojson',
            data: routeGeoJson,
          });
          mapRef.current!.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-line',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#f59e42',
              'line-width': 5,
              'line-opacity': 0.85,
            },
          });
        }
      }
    });
    // Copy the current value of zoneLayersRef to a local variable for cleanup
    const zoneLayerIds = [...zoneLayersRef.current];
    return () => {
      if (mapRef.current) {
        // Primero eliminar todas las capas
        zoneLayerIds.forEach(id => {
          try {
            if (mapRef.current!.getLayer(id)) mapRef.current!.removeLayer(id);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) { /* empty */ }
        });
        // Luego eliminar todas las fuentes (solo las fuentes base, no los -border ni -label)
        const baseSourceIds = Array.from(new Set(zoneLayerIds
          .map(id => id.replace(/(-border|-label)$/g, ''))));
        baseSourceIds.forEach(id => {
          try {
            if (mapRef.current!.getSource(id)) mapRef.current!.removeSource(id);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) { /* empty */ }
        });
        // Eliminar la capa y fuente de la ruta si existen
        try {
          if (mapRef.current.getLayer('route-line')) mapRef.current.removeLayer('route-line');
        // eslint-disable-next-line no-empty
        } catch {}
        try {
          if (mapRef.current.getSource('route-line')) mapRef.current.removeSource('route-line');
        // eslint-disable-next-line no-empty
        } catch {}
        mapRef.current.remove();
      }
    };
  }, [onPolygonCreate, onSelectZone, markers, showUserLocation, zones, hideDrawControls, adminZones, showAdminZones, route, showRoute, onMapClick]);

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
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapboxPolygon;