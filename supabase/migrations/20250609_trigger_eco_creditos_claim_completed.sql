-- 2025-06-09: Trigger para sumar 10 EcoCreditos al residente cuando un claim pasa a 'completed'

CREATE OR REPLACE FUNCTION sumar_eco_creditos_al_completar_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo sumar si el status cambió a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE profiles
    SET eco_creditos = eco_creditos + 10
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sumar_eco_creditos_al_completar_claim ON collection_claims;
CREATE TRIGGER trg_sumar_eco_creditos_al_completar_claim
AFTER UPDATE ON collection_claims
FOR EACH ROW
EXECUTE FUNCTION sumar_eco_creditos_al_completar_claim();
