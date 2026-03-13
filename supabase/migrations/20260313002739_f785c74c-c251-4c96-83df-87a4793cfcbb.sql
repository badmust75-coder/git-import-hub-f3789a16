CREATE POLICY "authenticated_can_read_user_roles"
ON user_roles
FOR SELECT
TO authenticated
USING (true);