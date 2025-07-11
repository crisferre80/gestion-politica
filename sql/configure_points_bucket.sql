-- =====================================================
-- CONFIGURACIÓN DEL BUCKET "POINTS" EN SUPABASE STORAGE
-- =====================================================
-- 
-- INSTRUCCIONES:
-- 1. Ve a https://supabase.com/dashboard/project/mfnvzijeanxvmolrprzj/storage/buckets
-- 2. Si no existe el bucket "points", créalo con estas configuraciones:
--    - Nombre: points
--    - Público: Sí (para permitir acceso a las URLs)
--    - Tamaño máximo de archivo: 2 MB (suficiente para fotos de materiales)
--    - Tipos de archivo permitidos: image/jpeg, image/png, image/webp
-- 
-- 3. Luego ve a https://supabase.com/dashboard/project/mfnvzijeanxvmolrprzj/sql
-- 4. Ejecuta el siguiente código SQL para configurar las políticas de acceso:
-- 
-- =====================================================

-- Políticas para el bucket "points"
-- Permitir que usuarios autenticados suban archivos
INSERT INTO storage.buckets (id, name, public)
VALUES ('points', 'points', true)
ON CONFLICT (id) DO UPDATE SET
public = true;

-- Política para permitir subir archivos (INSERT)
CREATE POLICY "Usuarios autenticados pueden subir fotos de puntos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'points' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir leer archivos (SELECT)
CREATE POLICY "Todos pueden ver fotos de puntos"
ON storage.objects FOR SELECT
USING (bucket_id = 'points');

-- Política para permitir actualizar archivos (UPDATE)
CREATE POLICY "Usuarios pueden actualizar sus propias fotos de puntos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'points' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'points' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir eliminar archivos (DELETE)
CREATE POLICY "Usuarios pueden eliminar sus propias fotos de puntos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'points' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%puntos%';
