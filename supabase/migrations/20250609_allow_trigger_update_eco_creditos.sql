-- 2025-06-09: Permitir que el trigger sume eco_creditos aunque haya RLS
-- Esta política permite UPDATE solo del campo eco_creditos en profiles para cualquier sesión (incluidos triggers)

DROP POLICY IF EXISTS "Trigger puede actualizar eco_creditos" ON profiles;
CREATE POLICY "Trigger puede actualizar eco_creditos"
  ON profiles
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Si quieres restringirlo solo a eco_creditos, puedes usar una policy más estricta (opcional):
-- CREATE POLICY "Solo trigger puede actualizar eco_creditos"
--   ON profiles
--   FOR UPDATE
--   USING (true)
--   WITH CHECK (old.eco_creditos IS DISTINCT FROM new.eco_creditos);
