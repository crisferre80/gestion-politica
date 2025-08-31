-- Asegura que `profiles.user_id` se setee desde el JWT si el cliente no lo provee.
-- Ejecuta este script con psql o supabase CLI en la DB del proyecto.

-- 1) Función que toma el sub del JWT y lo asigna a NEW.user_id si es NULL
CREATE OR REPLACE FUNCTION set_profiles_user_id_from_jwt()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    -- current_setting devuelve el claim sub del JWT en Supabase
    BEGIN
      NEW.user_id := current_setting('jwt.claims.sub', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
      -- Si no existe el claim, no hacemos nada
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Crear trigger antes de insert si no existe; sólo si la tabla `profiles` existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_set_user_id_trg'
    ) THEN
      CREATE TRIGGER profiles_set_user_id_trg
      BEFORE INSERT ON profiles
      FOR EACH ROW EXECUTE PROCEDURE set_profiles_user_id_from_jwt();
      RAISE NOTICE 'Trigger profiles_set_user_id_trg creado.';
    ELSE
      RAISE NOTICE 'Trigger profiles_set_user_id_trg ya existe; no se crea.';
    END IF;
  ELSE
    RAISE NOTICE 'Tabla "profiles" no encontrada; se omite la creación del trigger.';
  END IF;
END$$;

-- 3) Nota: la política RLS debe permitir INSERTs cuando user_id = auth.uid().
-- Con este trigger, si el cliente no provee user_id, la columna será rellenada
-- desde el claim JWT y la política RLS debería aceptar la fila.

-- 4) Comprobar que la política existe y es correcta (opcional)
-- SELECT policyname, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'profiles';

-- 5) Prueba manual (descomenta para ejecutar con un superusuario o desde una sesión con claims JWT válidos):
-- INSERT INTO profiles (email, name) VALUES ('prueba-trigger@example.com','Prueba Trigger');

-- Nota: este script sólo añade la función y el trigger. Asegúrate de que la política RLS
-- en `profiles` permite INSERT cuando user_id = auth.uid() (la función rellena user_id
-- desde el claim 'sub' si el cliente no lo provee).
