-- Crear tabla concentration_points faltante
-- Ejecutar este SQL en el SQL Editor de Supabase Dashboard

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

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_concentration_points_user_id ON concentration_points(user_id);
CREATE INDEX IF NOT EXISTS idx_concentration_points_type ON concentration_points(type);

-- Habilitar RLS
ALTER TABLE concentration_points ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "concentration_points_select_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_select_owner_or_admin" ON concentration_points
  FOR SELECT USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

DROP POLICY IF EXISTS "concentration_points_insert_owner" ON concentration_points;
CREATE POLICY "concentration_points_insert_owner" ON concentration_points
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

DROP POLICY IF EXISTS "concentration_points_update_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_update_owner_or_admin" ON concentration_points
  FOR UPDATE USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  ) WITH CHECK (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

DROP POLICY IF EXISTS "concentration_points_delete_owner_or_admin" ON concentration_points;
CREATE POLICY "concentration_points_delete_owner_or_admin" ON concentration_points
  FOR DELETE USING (
    user_id = auth.uid()::uuid
    OR (EXISTS (SELECT 1 FROM profiles p2 WHERE p2.user_id = auth.uid()::uuid AND p2.is_admin = true))
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'concentration_points_updated_at_trg') THEN
    CREATE TRIGGER concentration_points_updated_at_trg
    BEFORE UPDATE ON concentration_points
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END$$;
