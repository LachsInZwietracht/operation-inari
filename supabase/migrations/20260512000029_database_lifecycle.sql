-- ============================================================================
-- Database lifecycle and food reference replacement
-- ============================================================================

CREATE TABLE data_source_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('import', 'version_update', 'nutrient_mapping', 'license', 'change_note')
  ),
  version TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  record_count INTEGER,
  nutrient_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE food_reference_replacements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source_food_id UUID NOT NULL REFERENCES foods(id),
  target_food_id UUID NOT NULL REFERENCES foods(id),
  scope TEXT NOT NULL DEFAULT 'user_workspace' CHECK (scope IN ('user_workspace')),
  reason TEXT,
  recipe_ingredients_updated INTEGER NOT NULL DEFAULT 0,
  meal_entries_updated INTEGER NOT NULL DEFAULT 0,
  protocol_entries_updated INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_food_id <> target_food_id)
);

CREATE INDEX data_source_events_source_created_idx
  ON data_source_events(data_source_id, created_at DESC);

CREATE INDEX food_reference_replacements_actor_created_idx
  ON food_reference_replacements(actor_user_id, created_at DESC);

CREATE INDEX food_reference_replacements_org_created_idx
  ON food_reference_replacements(organization_id, created_at DESC);

ALTER TABLE data_source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_reference_replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_source_events_read" ON data_source_events
  FOR SELECT USING (true);

CREATE POLICY "food_reference_replacements_read_own" ON food_reference_replacements
  FOR SELECT USING (
    actor_user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND is_organization_admin(organization_id, auth.uid())
    )
  );

CREATE POLICY "food_reference_replacements_insert_own" ON food_reference_replacements
  FOR INSERT WITH CHECK (actor_user_id = auth.uid());

CREATE OR REPLACE FUNCTION replace_food_references(
  p_source_food_id UUID,
  p_target_food_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  replacement_id UUID,
  recipe_ingredients_updated INTEGER,
  meal_entries_updated INTEGER,
  protocol_entries_updated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requesting_user_id UUID := auth.uid();
  current_organization_id UUID;
  affected_recipe_ids UUID[];
  affected_meal_plan_ids UUID[];
  affected_protocol_ids UUID[];
  recipe_count INTEGER := 0;
  meal_count INTEGER := 0;
  protocol_count INTEGER := 0;
  inserted_replacement_id UUID;
BEGIN
  IF requesting_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_source_food_id IS NULL OR p_target_food_id IS NULL THEN
    RAISE EXCEPTION 'FOOD_ID_REQUIRED';
  END IF;

  IF p_source_food_id = p_target_food_id THEN
    RAISE EXCEPTION 'SOURCE_AND_TARGET_MUST_DIFFER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM foods
    WHERE id = p_source_food_id
      AND (is_custom = FALSE OR user_id = requesting_user_id)
  ) THEN
    RAISE EXCEPTION 'SOURCE_FOOD_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM foods
    WHERE id = p_target_food_id
      AND (is_custom = FALSE OR user_id = requesting_user_id)
  ) THEN
    RAISE EXCEPTION 'TARGET_FOOD_NOT_FOUND';
  END IF;

  SELECT organization_id INTO current_organization_id
  FROM organization_memberships
  WHERE user_id = requesting_user_id
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT COALESCE(array_agg(DISTINCT ri.recipe_id), ARRAY[]::UUID[])
    INTO affected_recipe_ids
  FROM recipe_ingredients ri
  JOIN recipes r ON r.id = ri.recipe_id
  WHERE r.user_id = requesting_user_id
    AND ri.food_id = p_source_food_id;

  UPDATE recipe_ingredients ri
  SET food_id = p_target_food_id
  FROM recipes r
  WHERE r.id = ri.recipe_id
    AND r.user_id = requesting_user_id
    AND ri.food_id = p_source_food_id;
  GET DIAGNOSTICS recipe_count = ROW_COUNT;

  IF array_length(affected_recipe_ids, 1) IS NOT NULL THEN
    UPDATE recipes
    SET updated_at = now()
    WHERE id = ANY(affected_recipe_ids);
  END IF;

  SELECT COALESCE(array_agg(DISTINCT me.meal_plan_id), ARRAY[]::UUID[])
    INTO affected_meal_plan_ids
  FROM meal_entries me
  JOIN daily_meal_plans dmp ON dmp.id = me.meal_plan_id
  WHERE dmp.user_id = requesting_user_id
    AND me.entry_type = 'food'
    AND me.reference_id = p_source_food_id;

  UPDATE meal_entries me
  SET reference_id = p_target_food_id
  FROM daily_meal_plans dmp
  WHERE dmp.id = me.meal_plan_id
    AND dmp.user_id = requesting_user_id
    AND me.entry_type = 'food'
    AND me.reference_id = p_source_food_id;
  GET DIAGNOSTICS meal_count = ROW_COUNT;

  IF array_length(affected_meal_plan_ids, 1) IS NOT NULL THEN
    UPDATE daily_meal_plans
    SET updated_at = now()
    WHERE id = ANY(affected_meal_plan_ids);
  END IF;

  SELECT COALESCE(array_agg(DISTINCT npe.protocol_id), ARRAY[]::UUID[])
    INTO affected_protocol_ids
  FROM nutrition_protocol_entries npe
  JOIN nutrition_protocols np ON np.id = npe.protocol_id
  WHERE np.user_id = requesting_user_id
    AND npe.food_id = p_source_food_id;

  UPDATE nutrition_protocol_entries npe
  SET food_id = p_target_food_id
  FROM nutrition_protocols np
  WHERE np.id = npe.protocol_id
    AND np.user_id = requesting_user_id
    AND npe.food_id = p_source_food_id;
  GET DIAGNOSTICS protocol_count = ROW_COUNT;

  IF array_length(affected_protocol_ids, 1) IS NOT NULL THEN
    UPDATE nutrition_protocols
    SET updated_at = now()
    WHERE id = ANY(affected_protocol_ids);
  END IF;

  INSERT INTO food_reference_replacements (
    actor_user_id,
    organization_id,
    source_food_id,
    target_food_id,
    reason,
    recipe_ingredients_updated,
    meal_entries_updated,
    protocol_entries_updated,
    metadata
  )
  VALUES (
    requesting_user_id,
    current_organization_id,
    p_source_food_id,
    p_target_food_id,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    recipe_count,
    meal_count,
    protocol_count,
    jsonb_build_object(
      'scope', 'user_workspace',
      'affected_recipe_ids', affected_recipe_ids,
      'affected_meal_plan_ids', affected_meal_plan_ids,
      'affected_protocol_ids', affected_protocol_ids
    )
  )
  RETURNING id INTO inserted_replacement_id;

  IF current_organization_id IS NOT NULL THEN
    INSERT INTO access_audit_logs (
      organization_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      current_organization_id,
      requesting_user_id,
      'food_reference_replaced',
      'food_reference_replacement',
      inserted_replacement_id::TEXT,
      jsonb_build_object(
        'source_food_id', p_source_food_id,
        'target_food_id', p_target_food_id,
        'recipe_ingredients_updated', recipe_count,
        'meal_entries_updated', meal_count,
        'protocol_entries_updated', protocol_count
      )
    );
  END IF;

  RETURN QUERY SELECT inserted_replacement_id, recipe_count, meal_count, protocol_count;
END;
$$;
