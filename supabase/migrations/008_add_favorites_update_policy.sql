-- Allow users to update their own favorites (needed for custom_name rename)
CREATE POLICY "favorites_update_own" ON user_favorites
  FOR UPDATE USING (auth.uid() = user_id);
