-- SQL to add delete policy for emergency_reports deduplication
-- Run this in your Supabase SQL Editor

-- Allow admins to delete reports (for deduplication)
CREATE POLICY "Admins can delete emergency reports" ON public.emergency_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND user_type IN ('admin', 'superadmin')
    )
  );
