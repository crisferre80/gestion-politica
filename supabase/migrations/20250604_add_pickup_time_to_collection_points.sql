-- Migración: Agregar pickup_time a concentration_points
ALTER TABLE concentration_points ADD COLUMN pickup_time timestamptz;
