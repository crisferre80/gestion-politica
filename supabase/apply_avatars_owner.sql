-- apply_avatars_owner.sql
-- Ejecutar como OWNER de la base de datos.
-- Habilita RLS en storage.objects y crea políticas para el bucket `avatars`.
-- ADVERTENCIA: ejecutar sólo desde una cuenta con privilegios de propietario.

BEGIN;

-- Habilitar Row Level Security en la tabla de objetos del storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- SELECT: permitir lectura solo a usuarios autenticados para el bucket avatars
DROP POLICY IF EXISTS allow_select_avatars_authenticated ON storage.objects;
CREATE POLICY allow_select_avatars_authenticated ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- INSERT: permitir subida por usuarios autenticados; permitimos owner NULL (uploads desde backend)
DROP POLICY IF EXISTS allow_insert_avatars_authenticated ON storage.objects;
CREATE POLICY allow_insert_avatars_authenticated ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (owner = auth.uid() OR owner IS NULL));

-- UPDATE: sólo propietario del objeto puede actualizar
DROP POLICY IF EXISTS allow_update_own_avatars ON storage.objects;
CREATE POLICY allow_update_own_avatars ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

-- DELETE: sólo propietario del objeto puede eliminar
DROP POLICY IF EXISTS allow_delete_own_avatars ON storage.objects;
CREATE POLICY allow_delete_own_avatars ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

COMMIT;

-- FIN
