-- ============================================================================
-- Custom products become real foods, owned by the client.
--
-- Today a barcode scan or a hand-entered product is stored as an inline copy
-- on the log row (`source_type = 'custom'` plus `custom_nutrients`). That has
-- three consequences nobody wants: scanning the same bar twice creates two
-- unrelated copies, correcting one does not correct the other, and there is no
-- list of "my products" because there is no row to list.
--
-- `foods` already supports exactly what is needed — `is_custom = TRUE` with
-- `user_id`, RLS scoped to the owner, and `search_foods` includes them when it
-- is given `requesting_user_id`. So no new table: client products become
-- ordinary custom foods under `data_source_id = 'custom'`, with the owner in
-- the `source_food_id` key so two people scanning the same product do not
-- collide on `UNIQUE(data_source_id, source_food_id)`.
--
-- What is missing is the counselor's side. Custom foods are owner-only, so a
-- client-owned product would render as a blank line in the counselor's view of
-- the diary — a regression against the inline copy it replaces. Three policies
-- fix that, scoped exactly like their siblings for recipes: only foods owned
-- by a client who has an active link and has consented to sharing nutrition.
-- ============================================================================

CREATE POLICY "foods_read_linked_client_custom" ON foods
  FOR SELECT USING (
    is_custom = TRUE
    AND user_id IS NOT NULL
    AND client_link_grants_access(user_id, 'nutrition')
  );

CREATE POLICY "food_nutrients_read_linked_client_custom" ON food_nutrients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_nutrients.food_id
        AND foods.is_custom = TRUE
        AND foods.user_id IS NOT NULL
        AND client_link_grants_access(foods.user_id, 'nutrition')
    )
  );

CREATE POLICY "food_portions_read_linked_client_custom" ON food_portions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM foods
      WHERE foods.id = food_portions.food_id
        AND foods.is_custom = TRUE
        AND foods.user_id IS NOT NULL
        AND client_link_grants_access(foods.user_id, 'nutrition')
    )
  );

-- Finding "my product for this barcode" again is the whole point of the
-- change, and it runs on every scan.
CREATE INDEX IF NOT EXISTS foods_custom_owner_idx
  ON foods(user_id, source_food_id)
  WHERE is_custom = TRUE;
