-- Migration: Rename roles in profiles
-- Purpose: Rename role string values to new convention:
--  - 'recycler' -> 'referente'
--  - 'dirigente' -> 'dirigente'
--  - 'dirigente_institutional' -> 'fiscal'
-- Note: Run this as a DB owner or service_role user. Backup recommended.

BEGIN;

-- Update existing profile rows
UPDATE public.profiles SET role = 'referente' WHERE role = 'recycler';
UPDATE public.profiles SET role = 'dirigente' WHERE role = 'dirigente';
UPDATE public.profiles SET role = 'fiscal' WHERE role = 'dirigente_institutional';

-- If other tables reference role literal strings in RLS policies or functions,
-- they may need manual updates. We update a few common places where migrations
-- include text defaults.

-- Update default value on profiles.role column if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    -- Set default to 'dirigente'
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'dirigente';
  END IF;
END$$;

-- IMPORTANT: Review and update any RLS policies referencing old strings like
-- role = 'recycler' or role = 'dirigente_institutional'. They must be updated
-- manually to use 'referente' and 'fiscal' respectively. This script does not
-- attempt to modify policy bodies.

COMMIT;
