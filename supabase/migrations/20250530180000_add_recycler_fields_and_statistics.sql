-- Agrega campo online a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online boolean DEFAULT false;

-- Agrega campos rating_average y total_ratings a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating_average double precision DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_ratings integer DEFAULT 0;

-- Trigger y función para actualizar rating_average y total_ratings en profiles al insertar o actualizar recycler_ratings
CREATE OR REPLACE FUNCTION update_recycler_rating_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET rating_average = (
    SELECT COALESCE(AVG(rating), 0) FROM recycler_ratings WHERE recycler_id = NEW.recycler_id
  ),
  total_ratings = (
    SELECT COUNT(*) FROM recycler_ratings WHERE recycler_id = NEW.recycler_id
  )
  WHERE user_id = NEW.recycler_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_recycler_rating_stats_insert ON recycler_ratings;
CREATE TRIGGER trg_update_recycler_rating_stats_insert
AFTER INSERT OR UPDATE OR DELETE ON recycler_ratings
FOR EACH ROW EXECUTE FUNCTION update_recycler_rating_stats();

-- Tabla de estadísticas de usuario
CREATE TABLE IF NOT EXISTS user_statistics (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  collections_completed integer DEFAULT 0,
  collections_cancelled integer DEFAULT 0,
  last_active_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger para actualizar updated_at en user_statistics
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
