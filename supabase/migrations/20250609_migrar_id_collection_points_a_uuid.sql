-- MIGRACIÓN: Migrar columna id de collection_points y claves foráneas a UUID
-- Fecha: 2025-06-09

-- 1. Eliminar políticas que dependen de id (y que bloquean el ALTER)
DROP POLICY IF EXISTS "Residente o reciclador puede actualizar punto" ON public.collection_points;
DROP POLICY IF EXISTS "Usuarios pueden actualizar solo sus propios puntos" ON public.collection_points;
DROP POLICY IF EXISTS "Usuarios pueden eliminar solo sus propios puntos" ON public.collection_points;
DROP POLICY IF EXISTS "Reciclador puede ver puntos reclamados" ON public.collection_points;

-- 2. Eliminar restricciones de clave foránea para collection_claims.collection_point_id
ALTER TABLE public.collection_claims DROP CONSTRAINT IF EXISTS collection_claims_collection_point_id_fkey;

-- 3. Cambiar tipo de columna id en collection_points a UUID (si no lo es ya)
ALTER TABLE public.collection_points
  ALTER COLUMN id TYPE uuid USING id::uuid;

-- 4. Cambiar tipo de columna collection_point_id en collection_claims a UUID (si no lo es ya)
ALTER TABLE public.collection_claims
  ALTER COLUMN collection_point_id TYPE uuid USING collection_point_id::uuid;

-- 5. Volver a crear la restricción de clave foránea
ALTER TABLE public.collection_claims
  ADD CONSTRAINT collection_claims_collection_point_id_fkey FOREIGN KEY (collection_point_id)
  REFERENCES public.collection_points(id) ON DELETE CASCADE;

-- 6. Volver a crear las políticas eliminadas
CREATE POLICY "Usuarios pueden actualizar solo sus propios puntos"
  ON public.collection_points
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar solo sus propios puntos"
  ON public.collection_points
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Reciclador puede ver puntos reclamados"
  ON public.collection_points
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM collection_claims
      WHERE collection_claims.collection_point_id = collection_points.id
        AND collection_claims.recycler_id = auth.uid()
    )
  );

CREATE POLICY "Residente o reciclador puede actualizar punto"
  ON public.collection_points
  FOR UPDATE
  TO public
  USING (
    (user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM collection_claims
      WHERE collection_claims.collection_point_id = collection_points.id
        AND collection_claims.recycler_id = auth.uid()
    )
  );

-- 7. (Opcional) Verifica si hay otras tablas con claves foráneas a collection_points.id y repite el proceso si es necesario.

-- 8. (Opcional) Si tienes datos legacy no UUID, deberás migrarlos a UUID válidos antes de este ALTER.

-- FIN DE MIGRACIÓN
