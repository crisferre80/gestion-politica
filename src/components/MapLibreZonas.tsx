import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import './maplibre-gl-terradraw.css';
// import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';

interface Zone {
  id?: string;
  name: string;
  color: string;
  coordinates: number[][][]; // GeoJSON Polygon
}

interface MapLibreZonasProps {
  zones: Zone[];
  onZoneCreated?: (zone: Zone) => void;
  reloadZones?: () => void;
}

const MAP_STYLE = 'https://tiles.stadiamaps.com/styles/osm_bright.json';

const MapLibreZonas: React.FC<MapLibreZonasProps> = ({ zones, onZoneCreated, reloadZones }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<InstanceType<typeof maplibregl.Map> | null>(null);
  const drawRef = useRef<MaplibreTerradrawControl | null>(null);
  // Estado para el modal de nueva zona
  const [pendingPolygon, setPendingPolygon] = useState<number[][][] | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneColor, setZoneColor] = useState('#3b82f6');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Estado para guardar zonas dibujadas
  const [showSaveAllModal, setShowSaveAllModal] = useState(false);
  const [drawnPolygons, setDrawnPolygons] = useState<GeoJSON.Feature<GeoJSON.Polygon>[]>([]);
  const [multiZoneData, setMultiZoneData] = useState<{ name: string; color: string; coordinates: number[][][]; }[]>([]);
  const [multiSaving, setMultiSaving] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [multiSuccess, setMultiSuccess] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;
    // Si ya existe un mapa, destrúyelo antes de crear uno nuevo
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [-64.2667, -27.7833],
      zoom: 13,
    });
    mapRef.current = map;
    // Mostrar zonas existentes y añadir control de dibujo SOLO cuando el mapa esté cargado
    map.on('load', () => {
      // Control de dibujo
      drawRef.current = new MaplibreTerradrawControl({
        modes: ['polygon', 'delete', 'select', 'download'],
      });
      map.addControl(drawRef.current, 'top-left');
      zones.forEach((zone, idx) => {
        const sourceId = `zone-source-${zone.id || idx}`;
        const layerId = `zone-layer-${zone.id || idx}`;
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: zone.coordinates,
            },
            properties: { name: zone.name, color: zone.color },
          },
        });
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': zone.color || '#3b82f6',
            'fill-opacity': 0.7,
          },
        });
        // Etiqueta
        map.addLayer({
          id: `${layerId}-label`,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': zone.name,
            'text-size': 14,
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#222',
            'text-halo-color': '#fff',
            'text-halo-width': 2,
          },
        });
      });
    });
    // Evento: cuando se termina de dibujar un polígono
    map.on('terra.draw.create', (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon') {
        setPendingPolygon(feature.geometry.coordinates as number[][][]);
        setZoneName('');
        setZoneColor('#3b82f6');
      }
    });
    // Evento: cuando se descarga el GeoJSON (botón Download)
    map.on('terra.draw.download', async (e: { features: GeoJSON.Feature[] }) => {
      if (!e.features || e.features.length === 0) return;
      for (const feature of e.features) {
        if (feature.geometry.type === 'Polygon') {
          // Pide nombre y color para cada polígono descargado
          const name = prompt('Nombre de la zona para guardar en Supabase:') || 'Zona sin nombre';
          const color = prompt('Color hex (ej: #3b82f6):', '#3b82f6') || '#3b82f6';
          const { error } = await supabase.from('zones').insert([
            { name, color, coordinates: feature.geometry.coordinates }
          ]);
          if (error) {
            alert('Error al guardar la zona: ' + error.message);
          } else {
            if (reloadZones) reloadZones();
            if (onZoneCreated) onZoneCreated({ name, color, coordinates: feature.geometry.coordinates as number[][][] });
            alert('Zona guardada en Supabase');
          }
        }
      }
    });
    // Forzar resize tras crear el mapa
    setTimeout(() => {
      map.resize();
    }, 200);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [zones, reloadZones, onZoneCreated]);

  // Forzar resize cuando el modal se abre y el mapa ya existe
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      }, 200);
    }
  }, []);

  // Guardar zona en Supabase
  const handleSaveZone = async () => {
    if (!pendingPolygon || !zoneName.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const { error } = await supabase.from('zones').insert([
      { name: zoneName.trim(), color: zoneColor, coordinates: pendingPolygon }
    ]);
    setSaving(false);
    if (error) {
      setSaveError('Error al guardar la zona. Intenta nuevamente.');
      return;
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
    setPendingPolygon(null);
    setZoneName('');
    setZoneColor('#3b82f6');
    if (reloadZones) reloadZones();
    if (onZoneCreated) onZoneCreated({ name: zoneName.trim(), color: zoneColor, coordinates: pendingPolygon });
  };

  // Cancelar creación
  const handleCancel = () => {
    setPendingPolygon(null);
    setZoneName('');
    setZoneColor('#3b82f6');
  };

  // Botón para guardar zonas dibujadas
  const handleShowSaveAll = () => {
    if (!drawRef.current) return;
    // Type guard to ensure getFeatures exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (drawRef.current as any).getFeatures !== 'function') {
      alert('No se puede obtener las zonas dibujadas.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features = (drawRef.current as any).getFeatures() as GeoJSON.FeatureCollection;
    const polygons = (features.features || []).filter((f: GeoJSON.Feature) => f.geometry.type === 'Polygon') as GeoJSON.Feature<GeoJSON.Polygon>[];
    if (polygons.length === 0) {
      alert('No hay polígonos dibujados para guardar.');
      return;
    }
    setDrawnPolygons(polygons);
    setMultiZoneData(polygons.map(() => ({ name: '', color: '#3b82f6', coordinates: [] })));
    setShowSaveAllModal(true);
  };

  // Guardar todas las zonas dibujadas
  const handleSaveAllZones = async () => {
    setMultiSaving(true);
    setMultiError(null);
    const toSave = multiZoneData.map((z, i) => ({
      name: z.name.trim() || `Zona ${i + 1}`,
      color: z.color,
      coordinates: drawnPolygons[i].geometry.coordinates as number[][][],
    }));
    const { error } = await supabase.from('zones').insert(toSave);
    setMultiSaving(false);
    if (error) {
      setMultiError('Error al guardar zonas: ' + error.message);
      return;
    }
    setMultiSuccess(true);
    setTimeout(() => setMultiSuccess(false), 1500);
    setShowSaveAllModal(false);
    setDrawnPolygons([]);
    setMultiZoneData([]);
    if (reloadZones) reloadZones();
  };

  // Actualizar nombre/color de cada zona
  const handleMultiZoneChange = (idx: number, field: 'name' | 'color', value: string) => {
    setMultiZoneData(prev => prev.map((z, i) => i === idx ? { ...z, [field]: value } : z));
  };

  // DEBUG: log para saber si pendingPolygon cambia
  useEffect(() => {
    if (pendingPolygon) {
      console.log('Se detectó un nuevo polígono pendiente:', pendingPolygon);
    }
  }, [pendingPolygon]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Botón para guardar todas las zonas dibujadas */}
      <button
        onClick={handleShowSaveAll}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 100,
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '10px 18px',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          cursor: 'pointer',
        }}
      >
        Guardar zonas dibujadas
      </button>
      <div ref={mapContainer} style={{ width: '100%', height: 500, border: '2px solid #3b82f6', borderRadius: 8, background: '#eee' }} />
      {/* Modal para guardar todas las zonas dibujadas */}
      {showSaveAllModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'white',
            border: '2px solid #3b82f6',
            borderRadius: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            padding: 24,
            minWidth: 340,
            maxWidth: 440,
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Guardar zonas dibujadas</h3>
            {drawnPolygons.map((poly, idx) => (
              <div key={idx} style={{ marginBottom: 18, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  Nombre:
                  <input
                    type="text"
                    value={multiZoneData[idx]?.name || ''}
                    onChange={e => handleMultiZoneChange(idx, 'name', e.target.value)}
                    style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4, marginTop: 4 }}
                    placeholder={`Zona ${idx + 1}`}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  Color:
                  <input
                    type="color"
                    value={multiZoneData[idx]?.color || '#3b82f6'}
                    onChange={e => handleMultiZoneChange(idx, 'color', e.target.value)}
                    style={{ marginLeft: 8, verticalAlign: 'middle' }}
                  />
                  <span style={{ marginLeft: 8 }}>{multiZoneData[idx]?.color || '#3b82f6'}</span>
                </label>
                <div style={{ fontSize: 12, color: '#888' }}>Coordenadas: {poly.geometry.coordinates[0].length} puntos</div>
              </div>
            ))}
            {multiError && <div style={{ color: 'red', marginBottom: 8 }}>{multiError}</div>}
            {multiSuccess && <div style={{ color: 'green', marginBottom: 8 }}>Zonas guardadas correctamente</div>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveAllModal(false)} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#eee', color: '#333', fontWeight: 500 }}>Cancelar</button>
              <button
                onClick={handleSaveAllZones}
                disabled={multiSaving || multiZoneData.some(z => !z.name.trim())}
                style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, opacity: multiSaving || multiZoneData.some(z => !z.name.trim()) ? 0.6 : 1 }}
              >
                {multiSaving ? 'Guardando...' : 'Guardar todas'}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingPolygon && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'white',
            border: '2px solid #3b82f6',
            borderRadius: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            padding: 24,
            minWidth: 320,
            maxWidth: 400,
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Nueva zona</h3>
            <label style={{ display: 'block', marginBottom: 8 }}>
              Nombre:
              <input
                type="text"
                value={zoneName}
                onChange={e => setZoneName(e.target.value)}
                style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4, marginTop: 4 }}
                placeholder="Nombre de la zona"
                autoFocus
              />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              Color:
              <input
                type="color"
                value={zoneColor}
                onChange={e => setZoneColor(e.target.value)}
                style={{ marginLeft: 8, verticalAlign: 'middle' }}
              />
              <span style={{ marginLeft: 8 }}>{zoneColor}</span>
            </label>
            {saveError && <div style={{ color: 'red', marginBottom: 8 }}>{saveError}</div>}
            {saveSuccess && <div style={{ color: 'green', marginBottom: 8 }}>Zona guardada correctamente</div>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={handleCancel} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#eee', color: '#333', fontWeight: 500 }}>Cancelar</button>
              <button
                onClick={handleSaveZone}
                disabled={!zoneName.trim() || saving}
                style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, opacity: !zoneName.trim() || saving ? 0.6 : 1 }}
              >
                {saving ? 'Guardando...' : 'Guardar zona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLibreZonas;
