-- Migración: Corregir constraint único de claims para permitir reclamar puntos cancelados
-- Fecha: 2025-06-08

-- Eliminar el constraint único problemático que impedía múltiples claims por punto
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_active_claim_per_point'
  ) THEN
    ALTER TABLE collection_claims
    DROP CONSTRAINT unique_active_claim_per_point;
  END IF;
END $$;

-- Mejorar el trigger para permitir múltiples claims cuando el anterior está cancelado
CREATE OR REPLACE FUNCTION prevent_duplicate_active_claims()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo prevenir si hay claims con status 'claimed' o 'completed' 
  -- (permitir nuevos claims si el último está 'cancelled')
  IF EXISTS (
    SELECT 1 FROM collection_claims
    WHERE collection_point_id = NEW.collection_point_id
      AND status IN ('claimed', 'completed')
      AND id <> COALESCE(NEW.id, uuid_generate_v4()) -- Manejar caso de INSERT
  ) THEN
    RAISE EXCEPTION 'Ya existe un claim activo (claimed/completed) para este punto de recolección';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger (ya existe pero actualizamos la función)
DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_claims ON collection_claims;
CREATE CONSTRAINT TRIGGER trg_prevent_duplicate_active_claims
AFTER INSERT OR UPDATE ON collection_claims
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_active_claims();

-- Asegurarse de que tenemos la extensión uuid-ossp para uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
