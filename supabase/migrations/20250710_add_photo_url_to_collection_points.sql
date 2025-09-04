-- Agregar campo photo_url a la tabla concentration_points
-- Para almacenar las URLs de las fotos de los materiales a recoger

ALTER TABLE concentration_points 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentario explicativo
COMMENT ON COLUMN concentration_points.photo_url IS 'URL de la foto del material a recoger, almacenada en el bucket "points" de Supabase Storage';
