-- Agregar campo photo_url a la tabla collection_points
-- Para almacenar las URLs de las fotos de los materiales a recoger

ALTER TABLE collection_points 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentario explicativo
COMMENT ON COLUMN collection_points.photo_url IS 'URL de la foto del material a recoger, almacenada en el bucket "points" de Supabase Storage';
