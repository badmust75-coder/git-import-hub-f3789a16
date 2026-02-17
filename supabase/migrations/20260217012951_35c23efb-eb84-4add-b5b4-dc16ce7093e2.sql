-- Add admin policies for managing user_sourate_progress (insert/update/delete)
-- This allows admin to approve validations and update student progress

CREATE POLICY "Admins can manage all sourate progress"
ON public.user_sourate_progress
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
