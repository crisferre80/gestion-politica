import { useEffect, useState, useCallback } from 'react';
import { fetchZones, createZone, updateZone, deleteZone } from '../lib/zonesApi';
import type { Zone } from '../lib/zonesApi';

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadZones = useCallback(async () => {
    setLoading(true);
    try {
      const zs = await fetchZones();
      setZones(zs);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadZones();
  }, [reloadZones]);

  const handleCreate = useCallback(async (zone: Omit<Zone, 'id'>) => {
    try {
      await createZone(zone);
      await reloadZones();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    }
  }, [reloadZones]);

  const handleEdit = useCallback(async (zone: Zone) => {
    try {
      await updateZone(zone);
      await reloadZones();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
    }
  }, [reloadZones]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteZone(id);
      await reloadZones();
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError(String(e));
    }
  }, [reloadZones]);

  return { zones, loading, error, handleCreate, handleEdit, handleDelete, reloadZones };
}
