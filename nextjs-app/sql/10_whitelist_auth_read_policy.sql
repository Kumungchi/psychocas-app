-- Allow authenticated users to read their own whitelist entry (for pre-check on login)
CREATE POLICY "authenticated_read_own_whitelist"
  ON member_whitelist
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
