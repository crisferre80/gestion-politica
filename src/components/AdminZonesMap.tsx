import { useState } from 'react';
import { supabase } from '../lib/supabase';
import MapLibreTerraDraw from './MapLibreTerraDraw';

// Tipos para GeoJSON Feature
interface ZoneFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    color: string;
    name?: string;
    [key: string]: any;
  };
}

interface AdminZonesMapProps {
  zones: ZoneFeature[];
  onZoneSaved?: () => void;
}

export default function AdminZonesMap({ zones, onZoneSaved }: AdminZonesMapProps) {
  const [features, setFeatures] = useState<ZoneFeature[]>(zones || []);
  const [newPolygon, setNewPolygon] = useState<ZoneFeature | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedZoneIdx, setSelectedZoneIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);

  // Guardar zona en Supabase
  const handleSaveZone = async () => {
    if (!zoneName || !newPolygon) return;
    setSaving(true);
    const { error } = await supabase.from('zones').insert([
      {
        name: zoneName,
        color: newPolygon.properties.color,
        coordinates: newPolygon.geometry.coordinates,
      },
    ]);
    setSaving(false);
    if (!error) {
      setFeatures([...features, { ...newPolygon, properties: { ...newPolygon.properties, name: zoneName } }]);
      setNewPolygon(null);
      setZoneName('');
      setShowNameInput(false);
      if (onZoneSaved) onZoneSaved();
    } else {
      alert('Error al guardar zona: ' + error.message);
    }
  };

  // Seleccionar zona para editar nombre
  const handleSelectZone = (idx: number) => {
    setSelectedZoneIdx(idx);
    setEditName(features[idx]?.properties?.name || '');
    setEditing(false);
    setShowNameInput(false);
    setNewPolygon(null);
  };

  // Guardar edición de nombre
  const handleSaveEditName = async () => {
    if (selectedZoneIdx === null) return;
    const zone = features[selectedZoneIdx];
    setSaving(true);
    const { error } = await supabase.from('zones').update({ name: editName }).eq('name', zone.properties.name);
    setSaving(false);
    if (!error) {
      const updated = [...features];
      updated[selectedZoneIdx] = { ...zone, properties: { ...zone.properties, name: editName } };
      setFeatures(updated);
      setEditing(false);
      if (onZoneSaved) onZoneSaved();
    } else {
      alert('Error al editar zona: ' + error.message);
    }
  };

  // Eliminar zona
  const handleDeleteZone = async () => {
    if (selectedZoneIdx === null) return;
    const zone = features[selectedZoneIdx];
    if (!window.confirm('¿Eliminar esta zona?')) return;
    setSaving(true);
    const { error } = await supabase.from('zones').delete().eq('name', zone.properties.name);
    setSaving(false);
    if (!error) {
      const updated = features.filter((_, i) => i !== selectedZoneIdx);
      setFeatures(updated);
      setSelectedZoneIdx(null);
      setEditing(false);
      if (onZoneSaved) onZoneSaved();
    } else {
      alert('Error al eliminar zona: ' + error.message);
    }
  };

  return (
    <div style={{ height: 500, width: '100%' }}>
      <div className="mb-2 flex gap-2 flex-wrap">
        {/* Botones y lógica de UI para zonas */}
        <button onClick={() => setShowNameInput(true)} className="bg-green-600 text-white px-4 py-2 rounded">Dibujar nueva zona</button>
        {showNameInput && (
          <>
            <input
              className="border px-2 py-1 rounded"
              placeholder="Nombre de la zona"
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              disabled={saving}
            />
            <button onClick={handleSaveZone} className="bg-blue-600 text-white px-4 py-2 rounded" disabled={saving || !zoneName}>Guardar zona</button>
          </>
        )}
        {selectedZoneIdx !== null && (
          <>
            <button onClick={() => setEditing(true)} className="bg-yellow-500 text-white px-4 py-2 rounded">Editar nombre</button>
            <button onClick={handleDeleteZone} className="bg-red-600 text-white px-4 py-2 rounded">Eliminar zona</button>
          </>
        )}
      </div>
      {editing && (
        <div className="mb-2 flex gap-2">
          <input
            className="border px-2 py-1 rounded"
            placeholder="Nuevo nombre"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            disabled={saving}
          />
          <button onClick={handleSaveEditName} className="bg-blue-600 text-white px-4 py-2 rounded" disabled={saving || !editName}>Guardar</button>
          <button onClick={() => setEditing(false)} className="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
        </div>
      )}
      <div className="mb-2 flex flex-wrap gap-2">
        {features.map((f, idx) => (
          <button
            key={idx}
            className={`px-3 py-1 rounded ${selectedZoneIdx === idx ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800'}`}
            onClick={() => handleSelectZone(idx)}
          >
            {f.properties?.name || `Zona ${idx+1}`}
          </button>
        ))}
      </div>
      {/* Nuevo mapa con TerraDraw y MapLibre */}
      <MapLibreTerraDraw />
    </div>
  );
}
