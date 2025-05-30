-- Agrega campos para bio, materials, experience_years, lat y lng a profiles
ALTER TABLE profiles ADD COLUMN bio text;
ALTER TABLE profiles ADD COLUMN materials text[];
ALTER TABLE profiles ADD COLUMN experience_years integer;
ALTER TABLE profiles ADD COLUMN lat double precision;
ALTER TABLE profiles ADD COLUMN lng double precision;
