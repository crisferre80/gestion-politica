-- Función RPC para respaldar y vaciar puntos retirados
CREATE OR REPLACE FUNCTION backup_and_clear_points(recycler_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Respaldar puntos retirados
  INSERT INTO concentration_points_backup (original_id, recycler_id, resident_id, point_data, deleted_at, created_at)
  SELECT id AS original_id, recycler_id, '00000000-0000-0000-0000-000000000000' AS resident_id, '{}'::jsonb AS point_data, NOW() AS deleted_at, created_at
  FROM concentration_points
  WHERE recycler_id = recycler_id AND status = 'retirado';

  -- Eliminar puntos retirados
  DELETE FROM concentration_points
  WHERE recycler_id = recycler_id AND status = 'retirado';
END;
$$ LANGUAGE plpgsql;
