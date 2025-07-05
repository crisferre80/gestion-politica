-- Script para crear función RPC segura para feedback
-- Esta función permite acceder a los datos de feedback sin problemas de recursión en RLS

-- Crear función RPC que omite RLS para obtener feedback
CREATE OR REPLACE FUNCTION public.get_all_feedback()
RETURNS SETOF public.feedback
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.feedback;
END;
$$;

-- Ajustar permisos para que solo usuarios autenticados puedan ejecutarla
REVOKE EXECUTE ON FUNCTION public.get_all_feedback() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO service_role;
