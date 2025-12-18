-- Supabase RLS Policies for Superadmin Access
-- Execute these statements in your Supabase SQL Editor to enable superadmin access to all users

-- 1. Create a helper function to check if the current user is a superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'user_type')::text = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Enable RLS on the users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Allow superadmins to SELECT all users
CREATE POLICY "Allow superadmins to read all users" 
ON public.users 
FOR SELECT 
USING (is_superadmin());

-- 4. Allow superadmins to UPDATE all users
CREATE POLICY "Allow superadmins to update all users" 
ON public.users 
FOR UPDATE 
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- 5. Allow superadmins to INSERT new users (if needed)
CREATE POLICY "Allow superadmins to insert users" 
ON public.users 
FOR INSERT 
WITH CHECK (is_superadmin());

-- 6. Allow superadmins to DELETE users (if needed)
CREATE POLICY "Allow superadmins to delete users" 
ON public.users 
FOR DELETE 
USING (is_superadmin());
