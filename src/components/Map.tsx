import React, { useEffect, useRef } from 'react';
import mapboxgl, { Map } from 'mapbox-gl';
import MapboxDraw, { DrawCreateEvent } from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiY3Jpc2ZlcnJlODAiLCJhIjoiY204MjliczYxMWhyZjJ0cTFrMWdldzMzMiJ9.Etd51sVEYQ1gyle4WN6PCQ';

interface AdminZone {
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
  showUserLocation?: boolean;
  zones?: AdminZone[];
}

const MapboxPolygon: React.FC<MapboxPolygonProps> = ({ onPolygonCreate, onSelectZone, markers = [], showUserLocation = false, zones = [] }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const zoneLayersRef = useRef<string[]>([]);

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
    // Agregar marcadores de recicladores
    markers.forEach(marker => {
      const el = document.createElement('div');
      el.style.width = '64px';
      el.style.height = '64px';
      el.style.backgroundImage = `url(/assets/bicireciclador-Photoroom.png)`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.title = marker.title;
      new mapboxgl.Marker(el)
        .setLngLat([marker.lng, marker.lat])
        .addTo(mapRef.current!);
    });
    // Mostrar zonas del administrador
    zones.forEach((zone, idx) => {
      if (!zone || !zone.coordinates) return;
      const id = `admin-zone-${idx}`;
      try {
        mapRef.current!.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: zone.coordinates,
            },
            properties: { id: zone.id },
          },
        });
        mapRef.current!.addLayer({
          id: id,
          type: 'fill',
          source: id,
          layout: {},
          paint: {
            'fill-color': zone.color || '#3b82f6', // color sólido definido por el selector
            'fill-opacity': 1, // opacidad total para color sólido
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
        zoneLayersRef.current.push(id, `${id}-border`);
        // Selección de zona al hacer click
        if (onSelectZone) {
          mapRef.current!.on('click', id, (e) => {
            const feature = e.features && e.features[0];
            const zoneId = feature && feature.properties && feature.properties.id;
            if (zoneId) onSelectZone(zoneId);
          });
        }
      } catch {
        // Puede fallar si el id ya existe
      }
    });
    // Mostrar ubicación del usuario si se solicita
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        if (userMarkerRef.current) userMarkerRef.current.remove();
        // Eliminado: marcador azul de ubicación del usuario
        // userMarkerRef.current = new mapboxgl.Marker({ color: '#3b82f6' })
        //   .setLngLat([longitude, latitude])
        //   .addTo(mapRef.current!);
        mapRef.current!.flyTo({ center: [longitude, latitude], zoom: 14 });
      });
    }
    // Copy the current value of zoneLayersRef to a local variable for cleanup
    const zoneLayerIds = [...zoneLayersRef.current];
    return () => {
      if (mapRef.current) {
        // Limpiar capas de zonas
        zoneLayerIds.forEach(id => {
          try {
            if (mapRef.current!.getLayer(id)) mapRef.current!.removeLayer(id);
            if (mapRef.current!.getSource(id)) mapRef.current!.removeSource(id);
          } catch { /* empty */ }
        });
        mapRef.current.remove();
      }
    };
  }, [onPolygonCreate, onSelectZone, markers, showUserLocation, zones]);

  return (
    <div style={{ width: '100%', height: 500, position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapboxPolygon;