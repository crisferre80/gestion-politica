-- Migración: Refuerzo de unicidad y lógica sólida para claims de Centros de Movilizaciòn
-- Fecha: 2025-06-07

-- 1. Restricción única: solo un claim activo por punto de recolección
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_active_claim_per_point'
  ) THEN
    ALTER TABLE collection_claims
    ADD CONSTRAINT unique_active_claim_per_point UNIQUE (collection_point_id)
    DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- 2. Trigger: Evitar múltiples claims activos (claimed/completed) para el mismo punto
CREATE OR REPLACE FUNCTION prevent_duplicate_active_claims()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM collection_claims
    WHERE collection_point_id = NEW.collection_point_id
      AND status IN ('claimed', 'completed')
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Ya existe un claim activo para este punto de recolección';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_claims ON collection_claims;
CREATE CONSTRAINT TRIGGER trg_prevent_duplicate_active_claims
AFTER INSERT OR UPDATE ON collection_claims
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_active_claims();

-- 3. (Opcional) Trigger: Cuando se crea un claim, actualizar el status del punto a 'claimed'
CREATE OR REPLACE FUNCTION set_point_claimed_on_claim()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE collection_points
  SET status = 'claimed'
  WHERE id = NEW.collection_point_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_point_claimed_on_claim ON collection_claims;
CREATE TRIGGER trg_set_point_claimed_on_claim
AFTER INSERT ON collection_claims
FOR EACH ROW EXECUTE FUNCTION set_point_claimed_on_claim();
