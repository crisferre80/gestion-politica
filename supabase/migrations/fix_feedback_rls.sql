-- Script para eliminar todas las políticas RLS existentes de la tabla feedback 
-- y aplicar solo las necesarias para que el administrador pueda leerlas

-- 1. Primero asegurémonos de que la tabla existe y tiene RLS activado
-- Si no existe, creamos la tabla
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('reclamo', 'sugerencia')),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitar RLS en la tabla feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar TODAS las políticas existentes para evitar conflictos
-- Esto elimina cualquier política que pueda estar causando problemas
DO $$
DECLARE
   policy_rec RECORD;
BEGIN
   FOR policy_rec IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'feedback' AND schemaname = 'public'
   LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedback', policy_rec.policyname);
   END LOOP;
END$$;

-- 4. Crear las políticas mínimas necesarias

-- Política para que cualquier usuario pueda INSERTAR feedback
CREATE POLICY "Insertar feedback - público"
  ON public.feedback
  FOR INSERT
  WITH CHECK (true);  -- Permitir que cualquier usuario registrado pueda enviar feedback

-- Política para que SOLO el administrador pueda VER el feedback
CREATE POLICY "Leer feedback - solo admin"
  ON public.feedback
  FOR SELECT
  USING (auth.uid() = 'a2a423a1-ac51-4a6b-8588-34918d8d81df');

-- Política para que SOLO el administrador pueda MODIFICAR el feedback
CREATE POLICY "Modificar feedback - solo admin"
  ON public.feedback
  FOR UPDATE
  USING (auth.uid() = 'a2a423a1-ac51-4a6b-8588-34918d8d81df');

-- Política para que SOLO el administrador pueda ELIMINAR el feedback
CREATE POLICY "Eliminar feedback - solo admin"
  ON public.feedback
  FOR DELETE
  USING (auth.uid() = 'a2a423a1-ac51-4a6b-8588-34918d8d81df');

-- 5. Verificar que las políticas se han aplicado correctamente
-- Para depuración: comentar o eliminar en producción
SELECT 
   schemaname, 
   tablename, 
   policyname, 
   permissive, 
   roles, 
   cmd, 
   qual
FROM pg_policies
WHERE tablename = 'feedback'
ORDER BY policyname;
