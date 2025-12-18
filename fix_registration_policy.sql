-- Fix RLS policy for user registration
-- Run this in your Supabase SQL Editor

-- First, drop all existing policies to start fresh
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                      policy_record.policyname,
                      policy_record.tablename);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'active'
      AND u.user_type IN ('admin','superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'active'
      AND u.user_type = 'superadmin'
  );
$$;

-- INSERT policy for registration
CREATE POLICY "Allow public user registration"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN coalesce(user_type, 'user') = 'user' THEN status IN ('active', 'pending_hospital')
    WHEN user_type IN ('admin', 'superadmin') THEN status IN ('pending_admin', 'active')
    ELSE false
  END
  AND NOT EXISTS (
    SELECT 1 FROM public.users existing
    WHERE existing.email = email
  )
);

-- SELECT policies
CREATE POLICY "Allow users to read their own profile"
ON public.users
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Allow superadmins to read all users"
ON public.users
FOR SELECT
USING (is_superadmin());

CREATE POLICY "Allow admins to read non-admin users"
ON public.users
FOR SELECT
USING (
  is_admin() AND
  user_type NOT IN ('superadmin', 'admin')
);

-- UPDATE policies
CREATE POLICY "Allow users to update their own profile"
ON public.users
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Allow superadmins to update all users"
ON public.users
FOR UPDATE
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Allow admins to update non-admin users"
ON public.users
FOR UPDATE
USING (
  is_admin() AND
  user_type NOT IN ('superadmin', 'admin')
)
WITH CHECK (
  is_admin() AND
  user_type NOT IN ('superadmin', 'admin')
);

-- Prevent self-deletion
CREATE POLICY "Prevent user self-deletion"
ON public.users
FOR DELETE
USING (false);

-- Allow superadmins to delete users
CREATE POLICY "Allow superadmins to delete users"
ON public.users
FOR DELETE
USING (is_superadmin());
