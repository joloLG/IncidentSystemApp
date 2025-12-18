-- Quick fix for middleware SELECT issue
-- Run this in Supabase SQL Editor to temporarily allow the middleware query

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;

-- Create a more permissive SELECT policy for authenticated users
CREATE POLICY "Allow authenticated users to read their own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());
