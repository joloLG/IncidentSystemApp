-- Supabase RLS Policies for MDRRMO App
-- Execute these statements in your Supabase SQL Editor to fix the notification issues.

-- --------------------------------------------------------
-- পলিসি (Policy) for user_notifications table
-- --------------------------------------------------------

-- 1. Enable RLS on the table if not already enabled
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Allow users to SELECT their own notifications
CREATE POLICY "Allow individual user to read their own notifications" 
ON public.user_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Allow users to UPDATE their own notifications (This is the FIX)
CREATE POLICY "Allow individual user to update their own notifications" 
ON public.user_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Allow new notifications to be INSERTed for a user (e.g., by the system)
-- This policy assumes inserts are done via a trusted server-side key, so it's permissive.
-- If inserts are done from the client, you might need a more specific rule.
CREATE POLICY "Allow insert for user notifications" 
ON public.user_notifications 
FOR INSERT 
WITH CHECK (true);


-- --------------------------------------------------------
-- পলিসি (Policy) for admin_notifications table
-- --------------------------------------------------------

-- Note: This policy identifies an admin by the specific email 'admin@mdrrmo.com'.
-- This is based on the project's specific setup.

-- Helper function to check if a user is an admin by user_type
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND user_type IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Enable RLS on the table if not already enabled
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Allow admins to SELECT all admin notifications
CREATE POLICY "Allow admins to read all notifications" 
ON public.admin_notifications 
FOR SELECT 
USING (is_admin());

-- 3. Allow admins to UPDATE notification read status
CREATE POLICY "Allow admins to update notification read status" 
ON public.admin_notifications 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin() AND (
  -- Only allow updating the is_read field
  (SELECT array_agg(key) FROM jsonb_each_text(to_jsonb(NEW)) WHERE key = 'is_read' AND value = 'true') IS NOT NULL
  AND
  -- Ensure no other fields are being modified
  (SELECT count(*) FROM (
    SELECT key FROM jsonb_each_text(to_jsonb(OLD))
    EXCEPT
    SELECT key FROM jsonb_each_text(to_jsonb(NEW))
    WHERE key != 'is_read' OR value != to_jsonb(OLD)->>key
  ) as changed_fields) = 0
));

-- 4. Allow new admin notifications to be INSERTed (e.g., when a new report is filed)
-- This is permissive, assuming inserts are trusted.
CREATE POLICY "Allow insert for admin notifications" 
ON public.admin_notifications 
FOR INSERT 
WITH CHECK (true);
