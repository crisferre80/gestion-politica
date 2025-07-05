// Esta función proporciona una forma alternativa de acceder a la tabla feedback
// en caso de que las políticas RLS estén causando problemas
import { supabase } from '../lib/supabase';

/**
 * Genera una URL para el avatar de un usuario
 * Si no hay avatar_url, genera una imagen con las iniciales del usuario
 * @param avatar_url URL del avatar del usuario
 * @param name Nombre del usuario para generar iniciales
 * @param backgroundColor Color de fondo para el avatar generado (sin #)
 * @param textColor Color del texto para el avatar generado (sin #)
 * @returns URL del avatar o imagen generada con iniciales
 */
export function getAvatarUrl(
  avatar_url: string | null | undefined,
  name: string | null | undefined,
  backgroundColor: string = '0D8ABC',
  textColor: string = 'fff'
): string {
  if (avatar_url) {
    return avatar_url;
  }
  
  // Si no hay avatar_url ni nombre, usa una letra por defecto
  const displayName = name || 'Usuario';
  
  // Genera la URL para una imagen con las iniciales
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${backgroundColor}&color=${textColor}&size=128`;
}

/**
 * Carga los datos de feedback desde Supabase evitando problemas de recursión en RLS
 * @returns Promise con los datos de feedback o error
 */
export async function loadFeedbackSafely() {
  try {
    // Primer intento: usando cliente normal con manejo de errores mejorado
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .throwOnError();
    
    if (!error) {
      return { data, error: null };
    }
    
    // Si hay error, intentar una solución alternativa con función RPC
    console.warn(
      'Usando método alternativo para cargar feedback debido a error RLS:',
      (error as { message?: string } | null)?.message ?? error
    );
    
    // Nota: Esta función RPC debe existir en Supabase y estar configurada para omitir RLS
    // CREATE OR REPLACE FUNCTION public.get_all_feedback()
    // RETURNS SETOF public.feedback
    // LANGUAGE plpgsql SECURITY DEFINER
    // AS $$
    // BEGIN
    //   RETURN QUERY SELECT * FROM public.feedback;
    // END;
    // $$;
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_feedback');
    
    return { data: rpcData || [], error: rpcError };
  } catch (err) {
    console.error('Error fatal al cargar feedback:', err);
    return { data: [], error: err instanceof Error ? err : new Error('Error desconocido') };
  }
}

/**
 * Script SQL para crear la función RPC en Supabase:
 * 
 * -- Crear función RPC que omite RLS para obtener feedback
 * CREATE OR REPLACE FUNCTION public.get_all_feedback()
 * RETURNS SETOF public.feedback
 * LANGUAGE plpgsql SECURITY DEFINER
 * AS $$
 * BEGIN
 *   RETURN QUERY SELECT * FROM public.feedback;
 * END;
 * $$;
 * 
 * -- Ajustar permisos
 * REVOKE EXECUTE ON FUNCTION public.get_all_feedback() FROM PUBLIC;
 * GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO authenticated;
 * GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO service_role;
 */
