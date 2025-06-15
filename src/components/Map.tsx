import React, { useEffect, useState, useRef, useImperativeHandle } from 'react';
import Map, { Marker, NavigationControl, MapRef } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Feature, Polygon, Position } from 'geojson';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Santiago del Estero coordinates
const SANTIAGO_CENTER = {
  longitude: -64.2667,
  latitude: -27.7833,
  zoom: 13
};

export interface Zone {
  id: string;
  name: string;
  color?: string;
  coordinates: Array<[number, number]>; // [lng, lat]
}

interface MapComponentProps {
  points: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    avatar_url?: string;
    role?: string;
    online?: boolean;
    iconUrl?: string; // NUEVO: URL del ícono personalizado
  }>;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (event: { lng: number; lat: number }) => void;
  showUserLocation?: boolean;
  showRoute?: boolean;
  routeDestination?: { lat: number; lng: number } | null;
  // NUEVO: para rutas multipunto
  routePoints?: Array<{ lat: number; lng: number }>;
  zones?: Zone[];
  isAdmin?: boolean;
  onZoneCreate?: (zone: Zone) => void;
  onZoneEdit?: (zone: Zone) => void;
  pendingZone?: Zone | null; // Recibe la zona pendiente como prop opcional
}

const MapComponent = React.forwardRef<{
  clearDraw: () => void;
}, MapComponentProps>(
  function MapComponent(
    {
      points,
      onMarkerClick,
      onMapClick,
      showUserLocation = false,
      showRoute = false,
      routeDestination,
      routePoints, // NUEVO
      zones = [],
      isAdmin = false,
      onZoneCreate,
      onZoneEdit,
      pendingZone, // Nueva prop para zona pendiente
    },
    ref
  ) {
    const [userLocation, setUserLocation] = useState<{
      lat: number;
      lng: number; latitude: number; longitude: number 
    } | null>(null);
    const mapRef = useRef<MapRef | null>(null);
    const [drawMode, setDrawMode] = useState<'none' | 'draw_polygon' | 'edit_polygon'>('none');
    const drawRef = useRef<MapboxDraw | null>(null);
    // Estado para saber si el mapa está listo
    const [mapReady, setMapReady] = useState(false);
    const [styleLoaded] = useState(false);

    // Asignar ref y marcar como listo
    const handleMapRef = (ref: MapRef | null) => {
      if (ref && !mapReady) {
        mapRef.current = ref;
        setMapReady(true);
      }
    };

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
              // setLocationError('No se pudo obtener tu ubicación');
            }
          );
        } else {
          // setLocationError('Tu navegador no soporta geolocalización');
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
          const map = mapRef.current.getMap();
          if (map.getLayer('route')) {
            map.removeLayer('route');
          }
          if (map.getSource('route')) {
            map.removeSource('route');
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
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: data.geometry
            }
          });

          map.addLayer({
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
        mapRef.current.getMap().fitBounds(bounds, { padding: 80, maxZoom: 15 });
        setHasCentered(true);
      }
    }, [onlineRecyclers, mapRef, hasCentered]);
    // Permitir manipulación libre después de centrar
    useEffect(() => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      const onMove = () => setHasCentered(true);
      map.on('dragstart', onMove);
      map.on('zoomstart', onMove);
      return () => {
        map.off('dragstart', onMove);
        map.off('zoomstart', onMove);
      };
    }, [mapRef]);

    // --- INTEGRACIÓN MAPBOX GL DRAW SOLO PARA ADMIN ---
    useEffect(() => {
      if (!isAdmin || !mapReady || !mapRef.current || !mapRef.current.getMap) return;
      const map = mapRef.current.getMap();
      if (!drawRef.current) {
        drawRef.current = new MapboxDraw({
          displayControlsDefault: false,
          controls: { polygon: true, trash: true },
          defaultMode: 'simple_select',
        });
        map.addControl(drawRef.current, 'top-left');
        console.log('MapboxDraw añadido');
      }
      // Cambiar modo de dibujo según drawMode
      if (drawMode === 'draw_polygon') {
        drawRef.current.changeMode('draw_polygon');
      } else if (drawMode === 'edit_polygon') {
        drawRef.current.changeMode('direct_select' as unknown as never);
      } else {
        drawRef.current.changeMode('simple_select');
      }
      // Evento para capturar creación de zona
      const handleDrawCreate = (e: MapboxDraw.DrawCreateEvent) => {
        if (onZoneCreate && e.features && e.features[0]) {
          const feature = e.features[0] as Feature<Polygon>;
          // Validar que el polígono tenga geometry y coordinates
          if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0] || feature.geometry.coordinates[0].length < 3) {
            alert('El polígono debe tener al menos 3 lados.');
            return;
          }
          // Usar nombre y color por defecto (elimina pendingZoneName/pendingZoneColor)
          const coordinates = (feature.geometry.coordinates[0] as Position[]).map(
            (pos) => [pos[0], pos[1]] as [number, number]
          );
          const zone: Zone = {
            id: String(feature.id),
            name: 'Nueva Zona',
            color: '#3b82f6',
            coordinates,
          };
          console.log('Zona creada:', zone);
          onZoneCreate(zone);
        }
      };
      map.on('draw.create', handleDrawCreate);
      // Evento para edición
      const handleDrawUpdate = (e: MapboxDraw.DrawUpdateEvent) => {
        if (onZoneEdit && e.features && e.features[0]) {
          const feature = e.features[0] as Feature<Polygon>;
          const coordinates = (feature.geometry.coordinates[0] as Position[]).map(
            (pos) => [pos[0], pos[1]] as [number, number]
          );
          if (coordinates.length < 4) return;
          const zone: Zone = {
            id: String(feature.id),
            name: 'Zona Editada',
            color: '#3b82f6',
            coordinates,
          };
          console.log('Zona editada:', zone);
          onZoneEdit(zone);
        }
      };
      map.on('draw.update', handleDrawUpdate);
      // Evento para terminar dibujo con botón derecho
      const handleContextMenu = (e: MouseEvent) => {
        if (drawMode === 'draw_polygon' && drawRef.current) {
          e.preventDefault();
          drawRef.current.changeMode('simple_select' as unknown as never);
        }
      };
      map.getCanvas().addEventListener('contextmenu', handleContextMenu);
      // Evento para cerrar polígono con doble clic
      const handleDoubleClick = (e: MouseEvent) => {
        if (drawMode === 'draw_polygon' && drawRef.current) {
          e.preventDefault();
          // No forzar el cambio de modo aquí, dejar que MapboxDraw maneje el cierre
          // Solo validar y disparar onZoneCreate si el polígono es válido
          const features = drawRef.current.getAll();
          if (features.features.length > 0) {
            const feature = features.features[0] as Feature<Polygon>;
            if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0] || feature.geometry.coordinates[0].length < 4) {
              alert('El polígono debe tener al menos 3 lados y estar cerrado.');
              return;
            }
            if (onZoneCreate) {
              const coordinates = (feature.geometry.coordinates[0] as Position[]).map(
                (pos) => [pos[0], pos[1]] as [number, number]
              );
              const zone: Zone = {
                id: String(feature.id),
                name: 'Nueva Zona',
                color: '#3b82f6',
                coordinates,
              };
              console.log('Zona creada (doble click):', zone);
              onZoneCreate(zone);
            }
          }
        }
      };
      map.getCanvas().addEventListener('dblclick', handleDoubleClick);
      return () => {
        if (drawRef.current) {
          map.removeControl(drawRef.current);
          drawRef.current = null;
        }
        map.off('draw.create', handleDrawCreate);
        map.off('draw.update', handleDrawUpdate);
        map.getCanvas().removeEventListener('contextmenu', handleContextMenu);
        map.getCanvas().removeEventListener('dblclick', handleDoubleClick);
      };
    }, [isAdmin, drawMode, onZoneCreate, onZoneEdit, mapReady]);

    // --- DIBUJAR POLILÍNEA MULTIPUNTO SI routePoints ESTÁ PRESENTE ---
    useEffect(() => {
      if (!mapRef.current) return;
      if (!routePoints || routePoints.length < 2) return; // Solo si hay al menos 2 puntos
      // Generar un id único para la capa y source de la ruta
      const routeId = `route-polyline-${Date.now()}`;
      // Limpiar todas las capas y sources previas que empiecen con 'route-polyline-'
      const map = mapRef.current.getMap();
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

    // --- DIBUJAR ZONAS COMO POLÍGONOS SOLO SI ES ADMIN ---
    const allZones = React.useMemo(() => (
      pendingZone && pendingZone.coordinates?.length >= 4
        ? [...(zones || []), { ...pendingZone, id: 'pending' }]
        : zones || []
    ), [pendingZone, zones]);

    // Adaptar coordinates: si es string, parsear a array
    const parsedZones = allZones.map(zone => {
      let coordinates = zone.coordinates;
      if (typeof coordinates === 'string') {
        try {
          coordinates = JSON.parse(coordinates);
        } catch (e) {
          console.error('Error al parsear coordinates de zona', zone, e);
          coordinates = [];
        }
      }
      return { ...zone, coordinates };
    });

    useEffect(() => {
      if (!mapRef.current || !styleLoaded) return;
      const map = mapRef.current.getMap();
      // Limpiar zonas previas
      if (parsedZones && parsedZones.length) {
        parsedZones.forEach(zone => {
          if (map.getLayer(`zone-${zone.id}`)) map.removeLayer(`zone-${zone.id}`);
          if (map.getLayer(`zone-line-${zone.id}`)) map.removeLayer(`zone-line-${zone.id}`);
          if (map.getSource(`zone-${zone.id}`)) map.removeSource(`zone-${zone.id}`);
        });
        // Agregar cada zona como un polígono
        parsedZones.forEach(zone => {
          map.addSource(`zone-${zone.id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [zone.coordinates],
              },
            },
          });
          map.addLayer({
            id: `zone-${zone.id}`,
            type: 'fill',
            source: `zone-${zone.id}`,
            layout: {},
            paint: {
              'fill-color': zone.color || '#3b82f6',
              'fill-opacity': zone.id === 'pending' ? 0.4 : 0.2,
            },
          });
          map.addLayer({
            id: `zone-line-${zone.id}`,
            type: 'line',
            source: `zone-${zone.id}`,
            layout: {},
            paint: {
              'line-color': zone.color || '#3b82f6',
              'line-width': 2,
            },
          });
        });
      }
    }, [parsedZones, isAdmin, mapReady, styleLoaded]);

    // --- INTEGRACIÓN MAPBOX GL DRAW SOLO PARA ADMIN ---
    useEffect(() => {
      if (!isAdmin || !mapReady || !mapRef.current || !mapRef.current.getMap) return;
      const map = mapRef.current.getMap();
      if (!drawRef.current) {
        drawRef.current = new MapboxDraw({
          displayControlsDefault: false,
          controls: { polygon: true, trash: true },
          defaultMode: 'simple_select',
        });
        map.addControl(drawRef.current, 'top-left');
        console.log('MapboxDraw añadido');
      }
      // Cambiar modo de dibujo según drawMode
      if (drawMode === 'draw_polygon') {
        drawRef.current.changeMode('draw_polygon');
      } else if (drawMode === 'edit_polygon') {
        drawRef.current.changeMode('direct_select' as unknown as never);
      } else {
        drawRef.current.changeMode('simple_select');
      }
      // Evento para capturar creación de zona
      const handleDrawCreate = (e: MapboxDraw.DrawCreateEvent) => {
        if (onZoneCreate && e.features && e.features[0]) {
          const feature = e.features[0] as Feature<Polygon>;
          // Validar que el polígono tenga geometry y coordinates
          if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0] || feature.geometry.coordinates[0].length < 3) {
            alert('El polígono debe tener al menos 3 lados.');
            return;
          }
          // Usar nombre y color por defecto (elimina pendingZoneName/pendingZoneColor)
          const coordinates = (feature.geometry.coordinates[0] as Position[]).map(
            (pos) => [pos[0], pos[1]] as [number, number]
          );
          const zone: Zone = {
            id: String(feature.id),
            name: 'Nueva Zona',
            color: '#3b82f6',
            coordinates,
          };
          console.log('Zona creada:', zone);
          onZoneCreate(zone);
        }
      };
      map.on('draw.create', handleDrawCreate);
      // Evento para edición
      const handleDrawUpdate = (e: MapboxDraw.DrawUpdateEvent) => {
        if (onZoneEdit && e.features && e.features[0]) {
          const feature = e.features[0] as Feature<Polygon>;
          const coordinates = (feature.geometry.coordinates[0] as Position[]).map(
            (pos) => [pos[0], pos[1]] as [number, number]
          );
          if (coordinates.length < 4) return;
          const zone: Zone = {
            id: String(feature.id),
            name: 'Zona Editada',
            color: '#3b82f6',
            coordinates,
          };
          console.log('Zona editada:', zone);
          onZoneEdit(zone);
        }
      };
      map.on('draw.update', handleDrawUpdate);
      // Evento para terminar dibujo con botón derecho
      const handleContextMenu = (e: MouseEvent) => {
        if (drawMode === 'draw_polygon' && drawRef.current) {
          e.preventDefault();
          drawRef.current.changeMode('simple_select' as unknown as never);
        }
      };
      map.getCanvas().addEventListener('contextmenu', handleContextMenu);
      // Evento para cerrar polígono con doble clic
      const handleDoubleClick = (e: MouseEvent) => {
        if (drawMode === 'draw_polygon' && drawRef.current) {
          e.preventDefault();
          // No forzar el cambio de modo aquí, dejar que MapboxDraw maneje el cierre
          // Solo validar y disparar onZoneCreate si el polígono es válido
          const features = drawRef.current.getAll();
          if (features.features.length > 0) {
            const feature = features.features[0] as Feature<Polygon>;
            if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0] || feature.geometry.coordinates[0].length < 4) {
              alert('El polígono debe tener al menos 3 lados y estar cerrado.');
              return;
            }
            if (onZoneCreate) {
              const coordinates = (feature.geometry.coordinates[0] as Position[]).map(
                (pos) => [pos[0], pos[1]] as [number, number]
              );
              const zone: Zone = {
                id: String(feature.id),
                name: 'Nueva Zona',
                color: '#3b82f6',
                coordinates,
              };
              console.log('Zona creada (doble click):', zone);
              onZoneCreate(zone);
            }
          }
        }
      };
      map.getCanvas().addEventListener('dblclick', handleDoubleClick);
      return () => {
        if (drawRef.current) {
          map.removeControl(drawRef.current);
          drawRef.current = null;
        }
        map.off('draw.create', handleDrawCreate);
        map.off('draw.update', handleDrawUpdate);
        map.getCanvas().removeEventListener('contextmenu', handleContextMenu);
        map.getCanvas().removeEventListener('dblclick', handleDoubleClick);
      };
    }, [isAdmin, drawMode, onZoneCreate, onZoneEdit, mapReady]);

    useImperativeHandle(ref, () => ({
      clearDraw: (mode?: 'draw_polygon' | 'edit_polygon') => {
        if (drawRef.current) {
          // Elimina polígonos temporales
          const all = drawRef.current.getAll();
          if (all && all.features.length > 0) {
            all.features.forEach(f => drawRef.current!.delete(f.id as string));
          }
        }
        if (mode) {
          setDrawMode(mode);
        } else {
          setDrawMode('none');
        }
      },
      setDrawMode: (mode: 'draw_polygon' | 'edit_polygon' | 'none') => {
        setDrawMode(mode);
      }
    }));

    // Mostrar el nombre sobre cada polígono (guardados y pendiente)
    useEffect(() => {
      if (!mapRef.current) return;
      // Elimina labels previos
      const prevLabels = document.querySelectorAll('.zone-label');
      prevLabels.forEach((el) => el.remove());
      // Mostrar nombre para cada zona
      allZones.forEach(zone => {
        if (zone.coordinates.length < 3) return;
        // Calcular centroide simple
        const coords = zone.coordinates;
        const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
        const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
        const el = document.createElement('div');
        el.className = 'zone-label';
        el.style.position = 'relative';
        el.style.background = 'rgba(34,197,94,0.95)';
        el.style.color = 'white';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '1rem';
        el.style.padding = '4px 12px';
        el.style.borderRadius = '8px';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        el.innerText = zone.name;
        new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(mapRef.current!.getMap());
      });
    }, [allZones, mapReady]);

    // --- RENDER MAPA ---
    if (!MAPBOX_TOKEN) {
      return (
        <div className="w-full h-[400px] flex items-center justify-center bg-gray-100 text-red-600 font-bold">
          Error: MAPBOX_TOKEN no definido. No se puede mostrar el mapa.
        </div>
      );
    }
    return (
      <div className="relative w-full h-[400px] md:h-[500px] rounded-lg overflow-hidden border border-gray-200">
        <Map
          ref={handleMapRef}
          initialViewState={SANTIAGO_CENTER}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          style={{ width: '100%', height: '100%' }}
          onClick={handleClick}
        >
          <NavigationControl position="top-right" />
          {/* Marcadores de puntos, si se usan */}
          {pointsToShow.map((point) => (
            <Marker
              key={point.id}
              longitude={point.lng}
              latitude={point.lat}
              anchor="bottom"
              onClick={() => onMarkerClick && onMarkerClick(point.id)}
            >
              {point.iconUrl && point.role === 'recycler' ? (
                <div style={{ position: 'relative', width: 60, height: 60 }}>
                  <img
                    src={point.iconUrl}
                    alt="Reciclador en bicicleta"
                    className="w-14 h-14 object-contain drop-shadow-lg"
                    style={{ pointerEvents: 'none', userSelect: 'none', width: 56, height: 56 }}
                  />
                  {point.avatar_url && (
                    <img
                      src={point.avatar_url}
                      alt="Avatar reciclador"
                      className="w-8 h-8 rounded-full border-2 border-white shadow-md absolute left-1/2 -translate-x-1/2"
                      style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '28px', width: 32, height: 32, borderRadius: '50%', border: '2px solid white', background: 'white' }}
                    />
                  )}
                </div>
              ) : point.iconUrl ? (
                <img
                  src={point.iconUrl}
                  alt="Punto de recolección"
                  className="w-10 h-10 object-contain drop-shadow-lg"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                />
              ) : (
                <div className="w-6 h-6 bg-green-600 rounded-full border-2 border-white shadow-lg" />
              )}
            </Marker>
          ))}
        </Map>
      </div>
    );
  }
);

export default MapComponent;