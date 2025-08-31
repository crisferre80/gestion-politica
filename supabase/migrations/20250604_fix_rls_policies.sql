-- Limpieza y optimización de políticas RLS (2025-06-04)
-- Reemplaza auth.uid() por (select auth.uid()) y elimina duplicados

-- 1. PROFILES
DROP POLICY IF EXISTS "Usuarios ven su perfil o admin" ON profiles;
CREATE POLICY "Usuarios ven su perfil o admin"
  ON profiles
  FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df' -- UID admin
  );

DROP POLICY IF EXISTS "Usuarios actualizan su perfil o admin" ON profiles;
CREATE POLICY "Usuarios actualizan su perfil o admin"
  ON profiles
  FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

-- 2. RECYCLER_RATINGS
DROP POLICY IF EXISTS "Usuarios pueden ver ratings de Dirigentes" ON recycler_ratings;
CREATE POLICY "Usuarios pueden ver ratings de Dirigentes"
  ON recycler_ratings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Usuarios pueden calificar Dirigentes" ON recycler_ratings;
CREATE POLICY "Usuarios pueden calificar Dirigentes"
  ON recycler_ratings
  FOR INSERT
  WITH CHECK (rater_id = (select auth.uid()));

-- 3. NOTIFICATIONS
DROP POLICY IF EXISTS "Usuarios ven sus notificaciones o admin" ON notifications;
CREATE POLICY "Usuarios ven sus notificaciones o admin"
  ON notifications
  FOR SELECT
  USING (
    user_id = (select auth.uid()) OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

DROP POLICY IF EXISTS "Admin puede insertar notificaciones para cualquier usuario" ON notifications;
CREATE POLICY "Admin puede insertar notificaciones para cualquier usuario"
  ON notifications
  FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid()) OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

-- 4. USER_STATISTICS
DROP POLICY IF EXISTS "Usuarios ven sus estadísticas o admin" ON user_statistics;
CREATE POLICY "Usuarios ven sus estadísticas o admin"
  ON user_statistics
  FOR SELECT
  USING (
    user_id = (select auth.uid()) OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

-- 5. COLLECTION_POINTS
DROP POLICY IF EXISTS "Cualquier usuario ve puntos disponibles" ON collection_points;
CREATE POLICY "Cualquier usuario ve puntos disponibles"
  ON collection_points
  FOR SELECT
  USING (
    status = 'available'
    OR user_id = (select auth.uid())
    OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

DROP POLICY IF EXISTS "Usuarios crean puntos propios" ON collection_points;
CREATE POLICY "Usuarios crean puntos propios"
  ON collection_points
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- 6. COLLECTION_CLAIMS
DROP POLICY IF EXISTS "Dirigentes pueden reclamar puntos" ON collection_claims;
CREATE POLICY "Dirigentes pueden reclamar puntos"
  ON collection_claims
  FOR INSERT
  WITH CHECK (recycler_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios ven claims propios o admin" ON collection_claims;
CREATE POLICY "Usuarios ven claims propios o admin"
  ON collection_claims
  FOR SELECT
  USING (
    recycler_id = (select auth.uid()) OR user_id = (select auth.uid()) OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

-- 7. MESSAGES
DROP POLICY IF EXISTS "Usuarios ven sus mensajes" ON messages;
CREATE POLICY "Usuarios ven sus mensajes"
  ON messages
  FOR SELECT
  USING (
    sender_id = (select auth.uid()) OR receiver_id = (select auth.uid()) OR (select auth.uid()) = 'a2a423a1-ac51-4a6b-8588-34918d8d81df'
  );

DROP POLICY IF EXISTS "Usuarios pueden enviar mensajes" ON messages;
CREATE POLICY "Usuarios pueden enviar mensajes"
  ON messages
  FOR INSERT
  WITH CHECK (sender_id = (select auth.uid()));

-- 8. ADVERTISEMENTS
DROP POLICY IF EXISTS "Todos pueden ver anuncios" ON advertisements;
CREATE POLICY "Todos pueden ver anuncios"
  ON advertisements
  FOR SELECT
  USING (true);

-- Fin de limpieza y optimización de RLS
