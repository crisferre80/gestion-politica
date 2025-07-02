-- Crear tabla para zonas de administrador si no existe
CREATE TABLE IF NOT EXISTS zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  coordinates JSONB NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Color en formato hex
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_zones_created_at ON zones(created_at);
CREATE INDEX IF NOT EXISTS idx_zones_created_by ON zones(created_by);
CREATE INDEX IF NOT EXISTS idx_zones_name ON zones(name);

-- Habilitar RLS (Row Level Security)
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Zones are viewable by everyone" ON zones;
DROP POLICY IF EXISTS "Only admins can modify zones" ON zones;

-- Política para que todos puedan ver las zonas
CREATE POLICY "Zones are viewable by everyone" ON zones
  FOR SELECT USING (true);

-- Política para que solo administradores puedan crear/editar zonas
CREATE POLICY "Only admins can modify zones" ON zones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Insertar algunas zonas de ejemplo si la tabla está vacía
INSERT INTO zones (name, coordinates, color)
SELECT 
  'Zona Centro',
  '[
    [
      [-64.2667, -27.7833],
      [-64.2600, -27.7833],
      [-64.2600, -27.7900],
      [-64.2667, -27.7900],
      [-64.2667, -27.7833]
    ]
  ]'::jsonb,
  '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM zones);

INSERT INTO zones (name, coordinates, color)
SELECT 
  'Zona Norte',
  '[
    [
      [-64.2700, -27.7700],
      [-64.2600, -27.7700],
      [-64.2600, -27.7750],
      [-64.2700, -27.7750],
      [-64.2700, -27.7700]
    ]
  ]'::jsonb,
  '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE name = 'Zona Norte');

-- Función para actualizar el timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar automáticamente updated_at
DROP TRIGGER IF EXISTS update_zones_updated_at ON zones;
CREATE TRIGGER update_zones_updated_at
    BEFORE UPDATE ON zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
