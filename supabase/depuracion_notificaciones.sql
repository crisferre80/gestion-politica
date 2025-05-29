-- Script para depuración automática de claves foráneas y usuarios huérfanos en Supabase
-- 1. Eliminar notificaciones con user_id inexistente en profiles
DELETE FROM notifications
WHERE user_id NOT IN (SELECT id FROM profiles);

-- 2. (Opcional) Mostrar usuarios huérfanos en notificaciones (para auditoría)
SELECT DISTINCT user_id FROM notifications
WHERE user_id NOT IN (SELECT id FROM profiles);

-- 3. (Opcional) Mostrar usuarios en profiles sin notificaciones (para auditoría)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM notifications);

-- 4. (Opcional) Verificar tipos de datos de los campos clave
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'id'
UNION ALL
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications' AND column_name = 'user_id';

-- 5. (Opcional) Prueba de inserción segura (reemplaza por un id válido)
-- INSERT INTO notifications (user_id, title, content, type)
-- VALUES ('AQUI_UN_ID_EXISTENTE', 'Test', 'Test', 'admin');
