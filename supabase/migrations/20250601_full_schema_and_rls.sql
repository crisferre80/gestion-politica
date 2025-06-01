-- FULL SCHEMA + RLS para EcoNecta (2025-06-01)
-- Incluye tablas, columnas, triggers y todas las RLS necesarias

-- =========================
-- DROP ALL (para entorno de desarrollo, quitar en producción)
-- =========================
DROP TABLE IF EXISTS user_statistics CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS recycler_ratings CASCADE;
DROP TABLE IF EXISTS collection_claims CASCADE;
DROP TABLE IF EXISTS collection_points CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS advertisements CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =========================
-- TABLAS PRINCIPALES
-- =========================
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

CREATE TABLE recycler_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recycler_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rater_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE user_statistics (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  collections_completed integer DEFAULT 0,
  collections_cancelled integer DEFAULT 0,
  last_active_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE collection_points (
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

CREATE TABLE collection_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_point_id uuid REFERENCES collection_points(id) ON DELETE CASCADE,
  recycler_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'claimed',
  pickup_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  sent_at timestamptz DEFAULT now()
);

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

CREATE OR REPLACE FUNCTION update_collection_points_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_collection_points_updated_at ON collection_points;
CREATE TRIGGER trg_update_collection_points_updated_at
BEFORE UPDATE ON collection_points
FOR EACH ROW EXECUTE FUNCTION update_collection_points_updated_at();

CREATE OR REPLACE FUNCTION update_collection_claims_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_collection_claims_updated_at ON collection_claims;
CREATE TRIGGER trg_update_collection_claims_updated_at
BEFORE UPDATE ON collection_claims
FOR EACH ROW EXECUTE FUNCTION update_collection_claims_updated_at();

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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycler_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Cambia este UID por el de tu admin real si es necesario
-- UID de ejemplo: 'f61d8fea-5758-47e9-852f-f5b92717b5ae'

-- 1. Admin puede ver todos los perfiles
DROP POLICY IF EXISTS "Usuarios ven su perfil o admin" ON profiles;
CREATE POLICY "Usuarios ven su perfil o admin"
  ON profiles
  FOR SELECT
  USING (
    id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- 2. Cualquier usuario puede ver perfiles de residentes de puntos disponibles
DROP POLICY IF EXISTS "Cualquier usuario ve perfiles de puntos disponibles" ON profiles;
CREATE POLICY "Cualquier usuario ve perfiles de puntos disponibles"
  ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
    OR id IN (SELECT user_id FROM collection_points WHERE status = 'available')
  );

-- 3. Cualquier usuario puede ver puntos de recolección disponibles
DROP POLICY IF EXISTS "Cualquier usuario ve puntos disponibles" ON collection_points;
CREATE POLICY "Cualquier usuario ve puntos disponibles"
  ON collection_points
  FOR SELECT
  USING (
    status = 'available'
    OR user_id = auth.uid()
    OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- 4. Usuarios pueden crear puntos propios
DROP POLICY IF EXISTS "Usuarios crean puntos propios" ON collection_points;
CREATE POLICY "Usuarios crean puntos propios"
  ON collection_points
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5. Recicladores pueden reclamar puntos
DROP POLICY IF EXISTS "Recicladores pueden reclamar puntos" ON collection_claims;
CREATE POLICY "Recicladores pueden reclamar puntos"
  ON collection_claims
  FOR INSERT
  WITH CHECK (recycler_id = auth.uid());

-- 6. Recicladores y residentes pueden ver sus claims y el admin todos
DROP POLICY IF EXISTS "Usuarios ven claims propios o admin" ON collection_claims;
CREATE POLICY "Usuarios ven claims propios o admin"
  ON collection_claims
  FOR SELECT
  USING (
    recycler_id = auth.uid() OR user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- 7. Todos pueden ver anuncios
DROP POLICY IF EXISTS "Todos pueden ver anuncios" ON advertisements;
CREATE POLICY "Todos pueden ver anuncios"
  ON advertisements
  FOR SELECT
  USING (true);

-- 8. Mensajes: usuarios ven/enviar los suyos y admin todos
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

-- 9. Ratings: todos pueden ver, solo residentes pueden calificar
DROP POLICY IF EXISTS "Usuarios pueden ver ratings de recicladores" ON recycler_ratings;
CREATE POLICY "Usuarios pueden ver ratings de recicladores"
  ON recycler_ratings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Usuarios pueden calificar recicladores" ON recycler_ratings;
CREATE POLICY "Usuarios pueden calificar recicladores"
  ON recycler_ratings
  FOR INSERT
  WITH CHECK (rater_id = auth.uid());

-- 10. Notificaciones: usuario y admin
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

-- 11. Estadísticas: usuario y admin
DROP POLICY IF EXISTS "Usuarios ven sus estadísticas o admin" ON user_statistics;
CREATE POLICY "Usuarios ven sus estadísticas o admin"
  ON user_statistics
  FOR SELECT
  USING (
    user_id = auth.uid() OR auth.uid() = 'f61d8fea-5758-47e9-852f-f5b92717b5ae'
  );

-- Fin de migración full para EcoNecta
