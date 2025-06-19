import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { LeafletEvent, Layer, LayerGroup, LatLng, Polygon as LeafletPolygon } from 'leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import { ErrorBoundary } from '../components/ErrorBoundary';

const MAP_STYLE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

interface MapaConPoligonosProps {
  zones: Array<{ id: string; name: string; color?: string; coordinates: [number, number][][] }>;

}

function MapaConPoligonos({ zones }: MapaConPoligonosProps) {
    const [polygons, setPolygons] = useState<Array<Array<[number, number]>>>([]);
    const mapRef = useRef<L.Map | null>(null);

    const extractLatLngs = (latLngs: LatLng | LatLng[] | LatLng[][] | LatLng[][][]): Array<[number, number]> => {
      if (Array.isArray(latLngs)) {
        if (Array.isArray(latLngs[0])) {
          if (Array.isArray(latLngs[0][0])) {
            return (latLngs[0][0] as LatLng[]).map((latlng) => [latlng.lat, latlng.lng]);
          }
          return (latLngs[0] as LatLng[]).map((latlng) => [latlng.lat, latlng.lng]);
        }
        return (latLngs as LatLng[]).map((latlng) => [latlng.lat, latlng.lng]);
      }
      return [[latLngs.lat, latLngs.lng]];
    };

    const handleCreate = useCallback((e: { layerType: string; layer: LeafletPolygon }) => {
      const { layerType, layer } = e;
      if (layerType === "polygon") {
        const newPolygon = extractLatLngs(layer.getLatLngs());
        if (newPolygon.length > 2 && newPolygon[0] !== newPolygon[newPolygon.length - 1]) {
          newPolygon.push(newPolygon[0]); // Cierra el polígono
        }
        setPolygons((prevPolygons) => [...prevPolygons, newPolygon]);
      }
    }, []);

    const handleEdit = useCallback((e: { layers: LayerGroup }) => {
      const { layers } = e;
      layers.eachLayer((layer: Layer) => {
        const editedPolygon = extractLatLngs((layer as LeafletPolygon).getLatLngs());
        setPolygons((prevPolygons) => prevPolygons.map((polygon) => {
          return JSON.stringify(polygon) === JSON.stringify(editedPolygon) ? editedPolygon : polygon;
        }));
      });
    }, []);

    const handleDelete = useCallback((e: { layers: LayerGroup }) => {
      const { layers } = e;
      layers.eachLayer((layer: Layer) => {
        const deletedPolygon = extractLatLngs((layer as LeafletPolygon).getLatLngs());
        setPolygons((prevPolygons) => prevPolygons.filter((polygon) => JSON.stringify(polygon) !== JSON.stringify(deletedPolygon)));
      });
    }, []);

    const initializeDrawControls = (map: L.Map | null) => {
      if (!map) {
        console.error('El mapa no está inicializado correctamente.');
        return;
      }

      const drawControl = new L.Control.Draw({
        draw: {
          rectangle: false,
          polyline: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
      });
      map.addControl(drawControl);

      map.on('draw:created', (e: LeafletEvent) => handleCreate(e as unknown as { layerType: string; layer: LeafletPolygon }));
      map.on('draw:edited', (e: LeafletEvent) => handleEdit(e as unknown as { layers: LayerGroup }));
      map.on('draw:deleted', (e: LeafletEvent) => handleDelete(e as unknown as { layers: LayerGroup }));
    };

    useEffect(() => {
      console.log('Zonas recibidas:', zones);
    }, [zones]);

    useEffect(() => {
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          console.log('Mapa destruido correctamente.');
        }
      };
    }, []);

    const handleDrawButtonClick = () => {
      if (mapRef.current) {
        const drawControl = new L.Control.Draw({
          draw: {
            rectangle: false,
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false,
          },
        });
        mapRef.current.addControl(drawControl);
        console.log('Control de dibujo agregado al mapa.');
      } else {
        console.error('El mapa no está inicializado.');
      }
    };

    return (
      <ErrorBoundary fallback={<div>Error al cargar el mapa.</div>}>
        <button onClick={handleDrawButtonClick} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
          Activar Dibujo
        </button>
        <MapContainer
          center={[-30.77357, -64.29938]}
          zoom={13}
          style={{ height: '500px', width: '100%' }}
          whenReady={() => {
            if (mapRef.current) {
              console.log('Mapa inicializado correctamente:', mapRef.current);
              initializeDrawControls(mapRef.current);
            } else {
              console.error('El mapa no está disponible en mapRef después de la inicialización.');
            }
          }}
          ref={mapRef}
        >
          <TileLayer
            url={MAP_STYLE}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FeatureGroup>
            {zones.map((zone, index) => (
              <Polygon key={index} positions={zone.coordinates} color={zone.color || 'blue'} />
            ))}
            {polygons.map((polygon, index) => (
              <Polygon key={`user-polygon-${index}`} positions={polygon} color="red" />
            ))}
          </FeatureGroup>
        </MapContainer>
      </ErrorBoundary>
    );
}

export default MapaConPoligonos;
