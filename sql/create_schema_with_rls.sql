-- Schema and RLS for EcoNecta3 (organización de dirigentes / recicladores)
-- Archivo:-- 9) Tabla concentration_points (puntos de concentración/colectivos)
CREATE TABLE IF NOT EXISTS concentration_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  address text,
  lat numeric,
  lng numeric,
  type text DEFAULT 'individual',
  photo_url text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10) Indexes comunesproject/sql/create_schema_with_rls.sql
-- Incluye: extensiones, tablas principales, índices y políticas RLS básicas para Supabase.

-- 1) Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- 2) Tabla de perfiles (relacionada con auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  name text,
  phone text,
  address text,
  bio text,
  avatar_url text,
  is_admin boolean DEFAULT false,
  online boolean DEFAULT false,
  role text DEFAULT 'resident', -- role/tipo: resident | recycler | resident_institutional
  dni text, -- documento de identidad opcional
  eco_creditos integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3) Tabla concentration_points (puntos / centros / refererencias por barrio)
CREATE TABLE IF NOT EXISTS concentration_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- propietario / creador (residente o institución)
  address text,
  lat numeric,
  lng numeric,
  description text,
  type text DEFAULT 'individual', -- individual | colective_point | other
  status text DEFAULT 'available', -- available | claimed | completed | cancelled
  creator_avatar text,
  claim_id uuid NULL, -- id del claim actualmente asociado (si corresponde)
  recycler_id uuid NULL, -- reciclador que actualmente reclama
  pickup_time timestamptz NULL,
  photo_url text NULL,
  completed_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) Tabla concentration_claims (reclamos por recicladores/dirigentes para un punto)
CREATE TABLE IF NOT EXISTS concentration_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concentration_point_id uuid NOT NULL REFERENCES concentration_points(id) ON DELETE CASCADE,
  recycler_id uuid NOT NULL, -- usuariorecycler que reclama
  user_id uuid NOT NULL, -- propietario del punto (redundante, facilita queries)
  status text DEFAULT 'claimed', -- claimed | cancelled | completed
  pickup_time timestamptz,
  cancelled_at timestamptz NULL,
  cancelled_reason text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5) Tabla recycler_routes (rutas guardadas por recicladores/dirigentes)
CREATE TABLE IF NOT EXISTS recycler_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recycler_id uuid NOT NULL,
  name text NOT NULL,
  point_ids uuid[] NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6) Tabla messages (mensajería entre usuarios)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 7) Tabla recycler_ratings (valoraciones de recicladores)
CREATE TABLE IF NOT EXISTS recycler_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recycler_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- 8) Ads tables (publicidad administrada)
CREATE TABLE IF NOT EXISTS ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text,
  link text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads_grid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid REFERENCES ads(id) ON DELETE SET NULL,
  size text, -- e.g., '2x2', '2x1', '1x2', '1x1'
  row integer,
  col integer,
  custom_label text,
  bg_color text
);

-- 9) Notifications (eventos dirigidos a usuario)
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text,
  message text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 10) Indexes comunes
CREATE INDEX IF NOT EXISTS idx_concentration_points_user_id ON concentration_points(user_id);
CREATE INDEX IF NOT EXISTS idx_concentration_points_status ON concentration_points(status);
CREATE INDEX IF NOT EXISTS idx_concentration_claims_recycler_id ON concentration_claims(recycler_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_concentration_points_user_id ON concentration_points(user_id);
CREATE INDEX IF NOT EXISTS idx_concentration_points_type ON concentration_points(type);

-- 11) Row Level Security (RLS)

-- profiles: cada usuario puede seleccionar su propio perfil y actualizarlo; los admins pueden ver todo
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT USING (
  (user_id = auth.uid()::uuid) OR (current_setting('jwt.claims.is_admin', true) = 'true')
  );


DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid
    OR (current_setting('jwt.claims.is_admin', true) = 'true')
  );

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles
  FOR UPDATE USING (user_id = auth.uid()::uuid OR (current_setting('jwt.claims.is_admin', true) = 'true'))
  WITH CHECK (user_id = auth.uid()::uuid OR (current_setting('jwt.claims.is_admin', true) = 'true'));

-- concentration_points: lectura pública limitada, propietarios y admins pueden CRUD
ALTER TABLE concentration_points ENABLE ROW LEVEL SECURITY;

-- SELECT: available para todos; propietario puede ver aunque no disponible; admins pueden ver
DROP POLICY IF EXISTS "concentration_points_select_public_or_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_select_public_or_owner_or_admin" ON concentration_points
  FOR SELECT USING (
    status = 'available'
    OR user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- INSERT: el user_id debe coincidir con auth.uid() o admin
DROP POLICY IF EXISTS "concentration_points_insert_owner" ON concentration_points;
CREATE POLICY "concentration_points_insert_owner" ON concentration_points
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- UPDATE: propietario o admin
DROP POLICY IF EXISTS "concentration_points_update_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_update_owner_or_admin" ON concentration_points
  FOR UPDATE USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  ) WITH CHECK (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- DELETE: propietario o admin
DROP POLICY IF EXISTS "concentration_points_delete_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_delete_owner_or_admin" ON concentration_points
  FOR DELETE USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- concentration_claims: crear reclamo debe ser realizado por reciclador (recycler_id == auth.uid())
ALTER TABLE concentration_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "concentration_claims_insert_recycler" ON concentration_claims;
CREATE POLICY "concentration_claims_insert_recycler" ON concentration_claims
  FOR INSERT WITH CHECK (
    recycler_id = auth.uid()::uuid
  );

-- SELECT: el reciclador, el dueño del punto o admin pueden ver


-- UPDATE: permitir al reciclador actualizar su propio claim (ej. cambiar status) o admin
DROP POLICY IF EXISTS "concentration_claims_select_related" ON concentration_claims;
CREATE POLICY "concentration_claims_select_related" ON concentration_claims
  FOR SELECT USING (
    recycler_id = auth.uid()::uuid
    OR user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

DROP POLICY IF EXISTS "concentration_claims_update_recycler_or_admin" ON concentration_claims;
CREATE POLICY "concentration_claims_update_recycler_or_admin" ON concentration_claims
  FOR UPDATE USING (
    recycler_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  ) WITH CHECK (
    recycler_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- concentration_points: lectura pública limitada, propietarios y admins pueden CRUD
ALTER TABLE concentration_points ENABLE ROW LEVEL SECURITY;

-- SELECT: propietario puede ver sus puntos; admins pueden ver todos
DROP POLICY IF EXISTS "concentration_points_select_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_select_owner_or_admin" ON concentration_points
  FOR SELECT USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- INSERT: el user_id debe coincidir con auth.uid() o admin
DROP POLICY IF EXISTS "concentration_points_insert_owner" ON concentration_points;
CREATE POLICY "concentration_points_insert_owner" ON concentration_points
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- UPDATE: propietario o admin
DROP POLICY IF EXISTS "concentration_points_update_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_update_owner_or_admin" ON concentration_points
  FOR UPDATE USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  ) WITH CHECK (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- DELETE: propietario o admin
DROP POLICY IF EXISTS "concentration_points_delete_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_delete_owner_or_admin" ON concentration_points
  FOR DELETE USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- recycler_routes: solo creador puede CRUD
ALTER TABLE recycler_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recycler_routes_owner_crud" ON recycler_routes;
CREATE POLICY "recycler_routes_owner_crud" ON recycler_routes
  FOR ALL USING (recycler_id = auth.uid()::uuid) WITH CHECK (recycler_id = auth.uid()::uuid);

-- messages: sender y receiver pueden ver; insertar sólo si sender_id = auth.uid()
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_insert_sender" ON messages;
CREATE POLICY "messages_insert_sender" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid()::uuid);
DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants" ON messages FOR SELECT USING (sender_id = auth.uid()::uuid OR receiver_id = auth.uid()::uuid);
DROP POLICY IF EXISTS "messages_update_sender_or_receiver" ON messages;
CREATE POLICY "messages_update_sender_or_receiver" ON messages FOR UPDATE USING (sender_id = auth.uid()::uuid OR receiver_id = auth.uid()::uuid) WITH CHECK (sender_id = auth.uid()::uuid OR receiver_id = auth.uid()::uuid);

-- recycler_ratings: permitimos insertar por reviewer (auth.uid()) y ver para todos (o solo para admin)
ALTER TABLE recycler_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recycler_ratings_insert_reviewer" ON recycler_ratings;
CREATE POLICY "recycler_ratings_insert_reviewer" ON recycler_ratings FOR INSERT WITH CHECK (reviewer_id = auth.uid()::uuid);
DROP POLICY IF EXISTS "recycler_ratings_select_public" ON recycler_ratings;
CREATE POLICY "recycler_ratings_select_public" ON recycler_ratings FOR SELECT USING (true);

-- ads: lectura pública, solo admins pueden insertar/editar
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ads_select_public" ON ads;
CREATE POLICY "ads_select_public" ON ads FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "ads_admin_write" ON ads;
CREATE POLICY "ads_admin_write" ON ads FOR ALL USING (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true));

ALTER TABLE ads_grid ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ads_grid_select_public" ON ads_grid;
CREATE POLICY "ads_grid_select_public" ON ads_grid FOR SELECT USING (true);
DROP POLICY IF EXISTS "ads_grid_admin_write" ON ads_grid;
CREATE POLICY "ads_grid_admin_write" ON ads_grid FOR ALL USING (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true));

-- notifications: el user_id receptor puede CRUD su notificaciones
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_owner_crud" ON notifications;
CREATE POLICY "notifications_owner_crud" ON notifications FOR ALL USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);

-- 12) Triggers para mantener updated_at

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach trigger to tables that have updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'concentration_points_updated_at_trg') THEN
    CREATE TRIGGER concentration_points_updated_at_trg
    BEFORE UPDATE ON concentration_points
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'concentration_claims_updated_at_trg') THEN
    CREATE TRIGGER concentration_claims_updated_at_trg
    BEFORE UPDATE ON concentration_claims
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'concentration_points_updated_at_trg') THEN
    CREATE TRIGGER concentration_points_updated_at_trg
    BEFORE UPDATE ON concentration_points
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END$$;

-- 14) Migraciones idempotentes: añadir columnas nuevas si no existen (compatibilidad con código cliente)
DO $$
BEGIN
  -- profiles: role, dni, eco_creditos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'resident';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='dni') THEN
    ALTER TABLE profiles ADD COLUMN dni text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='eco_creditos') THEN
    ALTER TABLE profiles ADD COLUMN eco_creditos integer DEFAULT 0;
  END IF;

  -- concentration_points: claim_id, recycler_id, pickup_time, photo_url, completed_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_points' AND column_name='claim_id') THEN
    ALTER TABLE concentration_points ADD COLUMN claim_id uuid NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_points' AND column_name='recycler_id') THEN
    ALTER TABLE concentration_points ADD COLUMN recycler_id uuid NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_points' AND column_name='pickup_time') THEN
    ALTER TABLE concentration_points ADD COLUMN pickup_time timestamptz NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_points' AND column_name='photo_url') THEN
    ALTER TABLE concentration_points ADD COLUMN photo_url text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_points' AND column_name='completed_at') THEN
    ALTER TABLE concentration_points ADD COLUMN completed_at timestamptz NULL;
  END IF;

  -- concentration_claims: renombrar point_id a concentration_point_id si existe
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_claims' AND column_name='point_id') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='concentration_claims' AND column_name='concentration_point_id') THEN
    ALTER TABLE concentration_claims RENAME COLUMN point_id TO concentration_point_id;
  END IF;

END$$;

-- 13) Notas y recomendaciones
--  - Después de aplicar este script, crea perfiles para cuentas existentes si es necesario.
--  - Ajusta políticas si deseas que algunas tablas sean completamente públicas o más restrictivas.
--  - Para ejecutar: usa psql o el CLI de Supabase. Ejemplo (local PowerShell):
--
--   psql "postgresql://<db_user>:<db_pass>@<db_host>:5432/postgres" -f project/sql/create_schema_with_rls.sql
--
--  o con Supabase CLI:
--
--   supabase db remote set <CONN_STRING>
--   supabase db push --file project/sql/create_schema_with_rls.sql

-- Fin del script
