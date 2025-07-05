-- Migración: Función para verificar si existe una tabla en Supabase
-- Fecha: 2025-07-05

-- Crear función para verificar si una tabla existe
CREATE OR REPLACE FUNCTION public.table_exists(table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_array(jsonb_build_object('exists', EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )))
  );
END;
$$;

-- Conceder permisos para todos los usuarios autenticados y anónimos
GRANT EXECUTE ON FUNCTION public.table_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.table_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.table_exists(text) TO service_role;
