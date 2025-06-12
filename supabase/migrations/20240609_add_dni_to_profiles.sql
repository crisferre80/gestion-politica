-- 2024-06-09: Agrega campo DNI obligatorio a profiles
ALTER TABLE profiles ADD COLUMN dni text NOT NULL;
