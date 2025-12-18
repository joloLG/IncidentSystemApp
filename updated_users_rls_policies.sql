-- ====================================================
-- UPDATED RLS POLICIES FOR USERS TABLE
-- ====================================================
-- This script drops all existing policies on the users table
-- and creates new, more secure policies that:
-- 1. Allow public registration (with proper validation)
-- 2. Allow users to read/update their own data
-- 3. Allow superadmins full access to all users
-- 4. Allow admins to manage non-admin users
-- 5. Enforce proper security for all operations
-- ====================================================

-- First, enable RLS on the users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- 1. DROP ALL EXISTING POLICIES
-- ====================================================
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

-- ====================================================
-- 2. HELPER FUNCTIONS
-- ====================================================

-- Function to check if current user is a superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users
    WHERE id = auth.uid()::uuid 
    AND user_type = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users
    WHERE id = auth.uid()::uuid 
    AND user_type = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if current user is a responder
CREATE OR REPLACE FUNCTION public.is_responder()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users
    WHERE id = auth.uid()::uuid 
    AND user_type = 'responder'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to get current user's type
CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS text AS $$
  SELECT user_type::text 
  FROM public.users 
  WHERE id = auth.uid()::uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ====================================================
-- 3. ALLOW ANONYMOUS USERS TO REGISTER
-- ====================================================
CREATE POLICY "Allow public user registration"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Only allow inserting with default 'user' role
  user_type = 'user' AND
  -- Ensure email is not already in use
  NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = new.email
  )
);

-- ====================================================
-- 4. ALLOW USERS TO READ THEIR OWN PROFILE
-- ====================================================
CREATE POLICY "Allow users to read their own profile"
ON public.users
FOR SELECT
USING (id = auth.uid());

-- ====================================================
-- 5. ALLOW USERS TO UPDATE THEIR OWN PROFILE
-- ====================================================
-- Users can update their own profile but can't change their role
CREATE POLICY "Allow users to update their own profile"
ON public.users
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() AND
  -- Prevent users from changing their own role
  (raw_user_meta_data->>'user_type')::text = current_user_type()
);

-- ====================================================
-- 6. SUPERADMIN POLICIES
-- ====================================================

-- Allow superadmins to read all users
CREATE POLICY "Allow superadmins to read all users"
ON public.users
FOR SELECT
USING (is_superadmin());

-- Allow superadmins to update all users
CREATE POLICY "Allow superadmins to update all users"
ON public.users
FOR UPDATE
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- Allow superadmins to delete users
CREATE POLICY "Allow superadmins to delete users"
ON public.users
FOR DELETE
USING (is_superadmin());

-- ====================================================
-- 7. ADMIN POLICIES
-- ====================================================

-- Allow admins to read non-admin users
CREATE POLICY "Allow admins to read non-admin users"
ON public.users
FOR SELECT
USING (
  is_admin() AND 
  (raw_user_meta_data->>'user_type')::text NOT IN ('superadmin', 'admin')
);

-- Allow admins to update non-admin users (but not change to superadmin)
CREATE POLICY "Allow admins to update non-admin users"
ON public.users
FOR UPDATE
USING (
  is_admin() AND 
  (raw_user_meta_data->>'user_type')::text NOT IN ('superadmin', 'admin')
)
WITH CHECK (
  is_admin() AND 
  (raw_user_meta_data->>'user_type')::text NOT IN ('superadmin', 'admin')
);

-- ====================================================
-- 8. RESPONDER POLICIES (if needed)
-- ====================================================
-- Add responder-specific policies here if needed

-- ====================================================
-- 9. ADDITIONAL SECURITY MEASURES
-- ====================================================
-- Prevent users from deleting their own accounts directly
-- (handle this through an application function instead)
CREATE POLICY "Prevent user self-deletion"
ON public.users
FOR DELETE
USING (false);

-- ====================================================
-- 10. GRANT NECESSARY PERMISSIONS
-- ====================================================
-- Ensure the appropriate permissions are set on the users table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO authenticated, anon;
