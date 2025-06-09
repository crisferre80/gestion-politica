-- 2025-06-09: Corrige RLS para permitir UPDATE en profiles por user_id
DROP POLICY IF EXISTS "Usuarios actualizan su perfil o admin" ON profiles;
CREATE POLICY "Usuarios actualizan su perfil o admin"
  ON profiles
  FOR UPDATE
  USING (
    user_id = auth.uid() OR auth.uid() = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );
