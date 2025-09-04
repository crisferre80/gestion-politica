-- MIGRACIÓN: Migrar columna id de concentration_points y claves foráneas a UUID
-- Fecha: 2025-06-09

-- 1. Eliminar políticas que dependen de id (y que bloquean el ALTER)
DROP POLICY IF EXISTS "Dirigente o reciclador puede actualizar punto" ON public.concentration_points;
DROP POLICY IF EXISTS "Usuarios pueden actualizar solo sus propios puntos" ON public.concentration_points;
DROP POLICY IF EXISTS "Usuarios pueden eliminar solo sus propios puntos" ON public.concentration_points;
DROP POLICY IF EXISTS "Reciclador puede ver puntos reclamados" ON public.concentration_points;

-- 2. Eliminar restricciones de clave foránea para concentration_claims.concentration_point_id
ALTER TABLE public.concentration_claims DROP CONSTRAINT IF EXISTS concentration_claims_concentration_point_id_fkey;

-- 3. Cambiar tipo de columna id en concentration_points a UUID (si no lo es ya)
ALTER TABLE public.concentration_points
  ALTER COLUMN id TYPE uuid USING id::uuid;

-- 4. Cambiar tipo de columna concentration_point_id en concentration_claims a UUID (si no lo es ya)
ALTER TABLE public.concentration_claims
  ALTER COLUMN concentration_point_id TYPE uuid USING concentration_point_id::uuid;

-- 5. Volver a crear la restricción de clave foránea
ALTER TABLE public.concentration_claims
  ADD CONSTRAINT concentration_claims_concentration_point_id_fkey FOREIGN KEY (concentration_point_id)
  REFERENCES public.concentration_points(id) ON DELETE CASCADE;

-- 6. Volver a crear las políticas eliminadas
CREATE POLICY "Usuarios pueden actualizar solo sus propios puntos"
  ON public.concentration_points
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar solo sus propios puntos"
  ON public.concentration_points
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Reciclador puede ver puntos reclamados"
  ON public.concentration_points
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM concentration_claims
      WHERE concentration_claims.concentration_point_id = concentration_points.id
        AND concentration_claims.recycler_id = auth.uid()
    )
  );

CREATE POLICY "Dirigente o reciclador puede actualizar punto"
  ON public.concentration_points
  FOR UPDATE
  TO public
  USING (
    (user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM concentration_claims
      WHERE concentration_claims.concentration_point_id = concentration_points.id
        AND concentration_claims.recycler_id = auth.uid()
    )
  );

-- 7. (Opcional) Verifica si hay otras tablas con claves foráneas a concentration_points.id y repite el proceso si es necesario.

-- 8. (Opcional) Si tienes datos legacy no UUID, deberás migrarlos a UUID válidos antes de este ALTER.

-- FIN DE MIGRACIÓN
