-- =====================================================
-- INSTRUCCIONES PARA EJECUTAR EN SUPABASE DASHBOARD
-- =====================================================
-- 
-- 1. Ve a https://supabase.com/dashboard/project/mfnvzijeanxvmolrprzj/sql
-- 2. Copia y pega el siguiente código SQL en el editor
-- 3. Haz clic en "Run" para ejecutar
-- 
-- =====================================================

-- Agregar campo photo_url a la tabla collection_points
-- Para almacenar las URLs de las fotos de los materiales a recoger
ALTER TABLE collection_points 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentario explicativo
COMMENT ON COLUMN collection_points.photo_url IS 'URL de la foto del material a recoger, almacenada en el bucket "points" de Supabase Storage';

-- Verificar que el campo se agregó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'collection_points' 
AND column_name = 'photo_url';
