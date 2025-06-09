-- 2025-06-09: Agrega campo eco_creditos a profiles para sistema de recompensas
ALTER TABLE profiles ADD COLUMN eco_creditos integer NOT NULL DEFAULT 0;
