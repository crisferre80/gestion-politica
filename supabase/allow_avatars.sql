-- allow_avatars.sql
-- SQL para habilitar políticas en storage.objects que permitan subir/leer/eliminar/actualizar
-- archivos del bucket `avatars` por usuarios autenticados (debe ejecutarse como OWNER de la BD).

-- allow_avatars.sql (diagnóstico)
-- Este script NO INTENTA ejecutar ALTER TABLE ni CREATE POLICY porque esas operaciones
-- requieren que el usuario sea OWNER de la tabla `storage.objects`.
-- En su lugar, informa del estado actual y muestra el SQL exacto que el OWNER debe ejecutar.

DO $$
DECLARE
  has_objects boolean;
  rls_enabled boolean := false;
  existing_policies text;
BEGIN
  -- ¿Existe la tabla storage.objects?
  SELECT to_regclass('storage.objects') IS NOT NULL INTO has_objects;
  IF NOT has_objects THEN
    RAISE NOTICE 'TABLE_NOT_FOUND: storage.objects no existe en esta base de datos.';
    RETURN;
  END IF;

  -- ¿Está RLS habilitado en storage.objects?
  SELECT c.relrowsecurity
    INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects';

  RAISE NOTICE 'RLS_ENABLED: %', rls_enabled;

  -- Políticas existentes
  SELECT coalesce(array_to_string(array_agg(policyname), ','), '(none)')
    INTO existing_policies
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects';

  RAISE NOTICE 'EXISTING_POLICIES: %', existing_policies;

  RAISE NOTICE '--- Si eres el OWNER, ejecuta las siguientes sentencias para habilitar RLS y crear policies ---';
  RAISE NOTICE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;';
  RAISE NOTICE ' ';
  RAISE NOTICE 'CREATE POLICY "allow_select_avatars_authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''avatars'');';
  RAISE NOTICE 'CREATE POLICY "allow_insert_avatars_authenticated" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''avatars'' AND (owner = auth.uid() OR owner IS NULL));';
  RAISE NOTICE 'CREATE POLICY "allow_update_own_avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''avatars'' AND owner = auth.uid()) WITH CHECK (bucket_id = ''avatars'' AND owner = auth.uid());';
  RAISE NOTICE 'CREATE POLICY "allow_delete_own_avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''avatars'' AND owner = auth.uid());';
  RAISE NOTICE '--- FIN ---';
END
$$;

-- Nota: estas políticas permiten a los usuarios autenticados subir archivos al bucket `avatars`.
-- Ejecútalo como el propietario (owner) de la base de datos. Si prefieres que todos los archivos sean
-- privados y accesibles sólo mediante URLs firmadas, mantén la política de SELECT restringida y
-- usa createSignedUrl() desde el cliente.

-- FIN
