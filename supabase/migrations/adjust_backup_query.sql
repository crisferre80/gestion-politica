-- Ajustar la consulta para respaldar y vaciar puntos retirados
-- Respaldar puntos retirados en collection_points_backup
INSERT INTO collection_points_backup (original_id, recycler_id, resident_id, point_data, deleted_at, created_at)
SELECT id AS original_id, recycler_id, '00000000-0000-0000-0000-000000000000' AS resident_id, '{}'::jsonb AS point_data, NOW() AS deleted_at, created_at
FROM collection_points
WHERE status = 'retirado';

-- Vaciar puntos retirados de collection_points
DELETE FROM collection_points
WHERE status = 'retirado';
