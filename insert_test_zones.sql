-- Script para insertar zonas de prueba en la tabla zones
-- Este script debe ejecutarse en el SQL Editor de Supabase

-- Primero, crear la tabla si no existe
CREATE TABLE IF NOT EXISTS zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  coordinates JSONB NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar zonas de prueba
INSERT INTO zones (name, coordinates, color) VALUES 
(
  'Zona Centro Santiago',
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
),
(
  'Zona Norte Santiago',
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
),
(
  'Zona Sur Santiago',
  '[
    [
      [-64.2600, -27.7950],
      [-64.2500, -27.7950],
      [-64.2500, -27.8000],
      [-64.2600, -27.8000],
      [-64.2600, -27.7950]
    ]
  ]'::jsonb,
  '#ef4444'
);

-- Verificar que se insertaron correctamente
SELECT * FROM zones;
