import { useEffect, useState, useCallback } from 'react';
import { fetchZones, createZone, updateZone } from '../lib/zonesApi';
import { Zone } from '../components/Map';

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchZones()
      .then(setZones)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = useCallback(async (zone: Omit<Zone, 'id'>) => {
    try {
      const newZone = await createZone(zone);
      setZones(zs => [...zs, newZone]);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    }
  }, []);

  const handleEdit = useCallback(async (zone: Zone) => {
    try {
      const updated = await updateZone(zone);
      setZones(zs => zs.map(z => z.id === updated.id ? updated : z));
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    }
  }, []);

  return { zones, loading, error, handleCreate, handleEdit };
}
