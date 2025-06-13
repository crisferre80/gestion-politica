import { supabase } from './supabase';
import { Zone } from '../components/Map';

export async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from('zones').select('*');
  if (error) throw error;
  return data || [];
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
