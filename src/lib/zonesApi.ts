import { supabase } from './supabase';

// Definir el tipo Zone localmente aquí (debe ser type, no import default)
export type Zone = {
  id: string;
  name: string;
  color?: string;
  coordinates: [number, number][][]; // Debe ser array de arrays para polígonos
  [key: string]: unknown;
};

export async function fetchZones(): Promise<Zone[]> {
  try {
    const { data, error } = await supabase.from('zones').select('*');
    if (error) {
      console.error('[fetchZones][ERROR]', error);
      return [];
    }
    // Adaptar coordinates si viene como string JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((z: any) => {
      let coordinates = z.coordinates;
      if (typeof coordinates === 'string') {
        try {
          coordinates = JSON.parse(coordinates);
        } catch (e) {
          console.error('Error al parsear coordinates de zona', z, e);
          coordinates = [];
        }
      }
      // Si coordinates no es array de arrays, lo normalizamos
      if (Array.isArray(coordinates) && Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
        coordinates = [coordinates];
      }
      return { ...z, coordinates };
    });
  } catch (e) {
    console.error('[fetchZones][EXCEPTION]', e);
    return [];
  }
}

export async function createZone(zone: Omit<Zone, 'id'>): Promise<Zone> {
  const { data, error } = await supabase.from('zones').insert([zone]).select().single();
  if (error) throw error;
  return data;
}

export async function updateZone(zone: Zone): Promise<Zone> {
  const { id, ...rest } = zone;
  const { data, error } = await supabase
    .from('zones')
    .update(rest)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteZone(id: string): Promise<void> {
  const { error } = await supabase.from('zones').delete().eq('id', id);
  if (error) throw error;
}
