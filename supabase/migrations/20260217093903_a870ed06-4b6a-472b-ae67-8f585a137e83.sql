
-- Allow admins to update profiles (for approving registrations)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Enable realtime for profiles to track new registrations
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
