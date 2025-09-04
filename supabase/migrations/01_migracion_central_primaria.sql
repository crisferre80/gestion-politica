-- =========================
-- TABLAS PRINCIPALES
-- =========================

DROP TABLE IF EXISTS user_statistics CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS recycler_ratings CASCADE;
DROP TABLE IF EXISTS concentration_claims CASCADE;
DROP TABLE IF EXISTS concentration_points CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS advertisements CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Tabla de perfiles de usuario
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text,
  email text UNIQUE,
  phone text,
  address text,
  bio text,
  avatar_url text,
  materials text[],
  lat double precision,
  lng double precision,
  online boolean DEFAULT false,
  role text,
  type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rating_average double precision DEFAULT 0,
  total_ratings integer DEFAULT 0
);

-- Tabla de ratings de Dirigentes
CREATE TABLE recycler_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recycler_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rater_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Tabla de notificaciones
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL,
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

-- Tabla de estadísticas de usuario
CREATE TABLE user_statistics (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  concentrations_completed integer DEFAULT 0,
  concentrations_cancelled integer DEFAULT 0,
  last_active_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de Centros de Movilizaciòn
CREATE TABLE concentration_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  address text,
  lat double precision,
  lng double precision,
  description text,
  status text DEFAULT 'available',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de reclamos de Centros de Movilizaciòn
CREATE TABLE concentration_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concentration_point_id uuid REFERENCES concentration_points(id) ON DELETE CASCADE,
  recycler_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'claimed',
  pickup_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de mensajes (chat)
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  sent_at timestamptz DEFAULT now()
);

-- Tabla de anuncios/publicidad
CREATE TABLE advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  link text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =========================
-- TRIGGERS Y FUNCIONES
-- =========================

-- Trigger para actualizar rating_average y total_ratings en profiles
CREATE OR REPLACE FUNCTION update_recycler_rating_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET rating_average = (
    SELECT COALESCE(AVG(rating), 0) FROM recycler_ratings WHERE recycler_id = NEW.recycler_id
  ),
  total_ratings = (
    SELECT COUNT(*) FROM recycler_ratings WHERE recycler_id = NEW.recycler_id
  )
  WHERE id = NEW.recycler_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_recycler_rating_stats_insert ON recycler_ratings;
CREATE TRIGGER trg_update_recycler_rating_stats_insert
AFTER INSERT OR UPDATE OR DELETE ON recycler_ratings
FOR EACH ROW EXECUTE FUNCTION update_recycler_rating_stats();

-- Trigger para updated_at en user_statistics
CREATE OR REPLACE FUNCTION update_user_statistics_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_statistics_updated_at ON user_statistics;
CREATE TRIGGER trg_update_user_statistics_updated_at
BEFORE UPDATE ON user_statistics
FOR EACH ROW EXECUTE FUNCTION update_user_statistics_updated_at();

-- Trigger para updated_at en concentration_points
CREATE OR REPLACE FUNCTION update_concentration_points_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_concentration_points_updated_at ON concentration_points;
CREATE TRIGGER trg_update_concentration_points_updated_at
BEFORE UPDATE ON concentration_points
FOR EACH ROW EXECUTE FUNCTION update_concentration_points_updated_at();

-- Trigger para updated_at en concentration_claims
CREATE OR REPLACE FUNCTION update_concentration_claims_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_concentration_claims_updated_at ON concentration_claims;
CREATE TRIGGER trg_update_concentration_claims_updated_at
BEFORE UPDATE ON concentration_claims
FOR EACH ROW EXECUTE FUNCTION update_concentration_claims_updated_at();

-- Trigger para updated_at en advertisements
CREATE OR REPLACE FUNCTION update_advertisements_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_advertisements_updated_at ON advertisements;
CREATE TRIGGER trg_update_advertisements_updated_at
BEFORE UPDATE ON advertisements
FOR EACH ROW EXECUTE FUNCTION update_advertisements_updated_at();

-- =========================
-- RLS (Row Level Security)
-- =========================

-- Habilitar RLS en todas las tablas principales
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycler_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE concentration_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE concentration_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Cambia este UID por el de tu admin real
-- Ejemplo: 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'admin@econecta.com') THEN
    INSERT INTO profiles (id, email, name, role) VALUES ('f61d8fea-5758-47e9-852f-f5b92717b5ae', 'admin@econecta.com', 'Admin', 'admin');
  END IF;
END;
$$;

-- RLS para profiles
DROP POLICY IF EXISTS "Usuarios ven su perfil o admin" ON profiles;
CREATE POLICY "Usuarios ven su perfil o admin"
  ON profiles
  FOR SELECT
  USING (
    id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

DROP POLICY IF EXISTS "Usuarios actualizan su perfil o admin" ON profiles;
CREATE POLICY "Usuarios actualizan su perfil o admin"
  ON profiles
  FOR UPDATE
  USING (
    id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- RLS para recycler_ratings
DROP POLICY IF EXISTS "Usuarios pueden ver ratings de Dirigentes" ON recycler_ratings;
CREATE POLICY "Usuarios pueden ver ratings de Dirigentes"
  ON recycler_ratings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Usuarios pueden calificar Dirigentes" ON recycler_ratings;
CREATE POLICY "Usuarios pueden calificar Dirigentes"
  ON recycler_ratings
  FOR INSERT
  WITH CHECK (rater_id = auth.uid());

-- RLS para notifications
DROP POLICY IF EXISTS "Usuarios ven sus notificaciones o admin" ON notifications;
CREATE POLICY "Usuarios ven sus notificaciones o admin"
  ON notifications
  FOR SELECT
  USING (
    user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

DROP POLICY IF EXISTS "Admin puede insertar notificaciones para cualquier usuario" ON notifications;
CREATE POLICY "Admin puede insertar notificaciones para cualquier usuario"
  ON notifications
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- RLS para user_statistics
DROP POLICY IF EXISTS "Usuarios ven sus estadísticas o admin" ON user_statistics;
CREATE POLICY "Usuarios ven sus estadísticas o admin"
  ON user_statistics
  FOR SELECT
  USING (
    user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- RLS para concentration_points
DROP POLICY IF EXISTS "Usuarios ven puntos propios o admin" ON concentration_points;
CREATE POLICY "Usuarios ven puntos propios o admin"
  ON concentration_points
  FOR SELECT
  USING (
    user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

DROP POLICY IF EXISTS "Usuarios crean puntos propios" ON concentration_points;
CREATE POLICY "Usuarios crean puntos propios"
  ON concentration_points
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS para concentration_claims
DROP POLICY IF EXISTS "Usuarios ven claims propios o admin" ON concentration_claims;
CREATE POLICY "Usuarios ven claims propios o admin"
  ON concentration_claims
  FOR SELECT
  USING (
    recycler_id = auth.uid() OR user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

DROP POLICY IF EXISTS "Dirigentes pueden reclamar puntos" ON concentration_claims;
CREATE POLICY "Dirigentes pueden reclamar puntos"
  ON concentration_claims
  FOR INSERT
  WITH CHECK (recycler_id = auth.uid());

-- RLS para messages
DROP POLICY IF EXISTS "Usuarios ven sus mensajes" ON messages;
CREATE POLICY "Usuarios ven sus mensajes"
  ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR receiver_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

DROP POLICY IF EXISTS "Usuarios pueden enviar mensajes" ON messages;
CREATE POLICY "Usuarios pueden enviar mensajes"
  ON messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- RLS para advertisements (todos pueden ver)
DROP POLICY IF EXISTS "Todos pueden ver anuncios" ON advertisements;
CREATE POLICY "Todos pueden ver anuncios"
  ON advertisements
  FOR SELECT
  USING (true);

-- ¡Listo! Esta migración deja tu base lista para EcoNecta3, con triggers y RLS.