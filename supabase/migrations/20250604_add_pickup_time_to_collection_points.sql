-- Migración: Agregar pickup_time a collection_points
ALTER TABLE collection_points ADD COLUMN pickup_time timestamptz;
