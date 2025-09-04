-- Ajustar la consulta para respaldar y vaciar puntos retirados
-- Respaldar puntos retirados en concentration_points_backup
INSERT INTO concentration_points_backup (original_id, recycler_id, dirigente_id, point_data, deleted_at, created_at)
SELECT id AS original_id, recycler_id, '00000000-0000-0000-0000-000000000000' AS dirigente_id, '{}'::jsonb AS point_data, NOW() AS deleted_at, created_at
FROM concentration_points
WHERE status = 'retirado';

-- Vaciar puntos retirados de concentration_points
DELETE FROM concentration_points
WHERE status = 'retirado';
