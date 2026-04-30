-- ============================================================================
-- Extend food reference replacement with organization scope
-- ============================================================================

-- Allow 'organization' scope in the check constraint
ALTER TABLE food_reference_replacements
  DROP CONSTRAINT IF EXISTS food_reference_replacements_scope_check;

ALTER TABLE food_reference_replacements
  ADD CONSTRAINT food_reference_replacements_scope_check
  CHECK (scope IN ('user_workspace', 'organization'));

-- Replace the function with scope-aware version
CREATE OR REPLACE FUNCTION replace_food_references(
  p_source_food_id UUID,
  p_target_food_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_scope TEXT DEFAULT 'user_workspace'
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
  effective_scope TEXT := COALESCE(p_scope, 'user_workspace');
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

  IF effective_scope NOT IN ('user_workspace', 'organization') THEN
    RAISE EXCEPTION 'INVALID_SCOPE';
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

  -- Resolve organization membership
  SELECT om.organization_id INTO current_organization_id
  FROM organization_memberships om
  WHERE om.user_id = requesting_user_id
    AND om.status = 'active'
  ORDER BY om.created_at ASC
  LIMIT 1;

  -- For organization scope, verify admin/owner role
  IF effective_scope = 'organization' THEN
    IF current_organization_id IS NULL THEN
      RAISE EXCEPTION 'NO_ORGANIZATION';
    END IF;
    IF NOT is_organization_admin(current_organization_id, requesting_user_id) THEN
      RAISE EXCEPTION 'ORG_ADMIN_REQUIRED';
    END IF;
  END IF;

  -- === Recipes ===
  IF effective_scope = 'user_workspace' THEN
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
  ELSE
    SELECT COALESCE(array_agg(DISTINCT ri.recipe_id), ARRAY[]::UUID[])
      INTO affected_recipe_ids
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id
    WHERE r.organization_id = current_organization_id
      AND ri.food_id = p_source_food_id;

    UPDATE recipe_ingredients ri
    SET food_id = p_target_food_id
    FROM recipes r
    WHERE r.id = ri.recipe_id
      AND r.organization_id = current_organization_id
      AND ri.food_id = p_source_food_id;
  END IF;
  GET DIAGNOSTICS recipe_count = ROW_COUNT;

  IF array_length(affected_recipe_ids, 1) IS NOT NULL THEN
    UPDATE recipes SET updated_at = now() WHERE id = ANY(affected_recipe_ids);
  END IF;

  -- === Meal entries ===
  IF effective_scope = 'user_workspace' THEN
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
  ELSE
    SELECT COALESCE(array_agg(DISTINCT me.meal_plan_id), ARRAY[]::UUID[])
      INTO affected_meal_plan_ids
    FROM meal_entries me
    JOIN daily_meal_plans dmp ON dmp.id = me.meal_plan_id
    WHERE dmp.organization_id = current_organization_id
      AND me.entry_type = 'food'
      AND me.reference_id = p_source_food_id;

    UPDATE meal_entries me
    SET reference_id = p_target_food_id
    FROM daily_meal_plans dmp
    WHERE dmp.id = me.meal_plan_id
      AND dmp.organization_id = current_organization_id
      AND me.entry_type = 'food'
      AND me.reference_id = p_source_food_id;
  END IF;
  GET DIAGNOSTICS meal_count = ROW_COUNT;

  IF array_length(affected_meal_plan_ids, 1) IS NOT NULL THEN
    UPDATE daily_meal_plans SET updated_at = now() WHERE id = ANY(affected_meal_plan_ids);
  END IF;

  -- === Protocol entries ===
  IF effective_scope = 'user_workspace' THEN
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
  ELSE
    SELECT COALESCE(array_agg(DISTINCT npe.protocol_id), ARRAY[]::UUID[])
      INTO affected_protocol_ids
    FROM nutrition_protocol_entries npe
    JOIN nutrition_protocols np ON np.id = npe.protocol_id
    WHERE np.organization_id = current_organization_id
      AND npe.food_id = p_source_food_id;

    UPDATE nutrition_protocol_entries npe
    SET food_id = p_target_food_id
    FROM nutrition_protocols np
    WHERE np.id = npe.protocol_id
      AND np.organization_id = current_organization_id
      AND npe.food_id = p_source_food_id;
  END IF;
  GET DIAGNOSTICS protocol_count = ROW_COUNT;

  IF array_length(affected_protocol_ids, 1) IS NOT NULL THEN
    UPDATE nutrition_protocols SET updated_at = now() WHERE id = ANY(affected_protocol_ids);
  END IF;

  -- === Record replacement ===
  INSERT INTO food_reference_replacements (
    actor_user_id, organization_id, source_food_id, target_food_id,
    scope, reason, recipe_ingredients_updated, meal_entries_updated,
    protocol_entries_updated, metadata
  )
  VALUES (
    requesting_user_id, current_organization_id, p_source_food_id, p_target_food_id,
    effective_scope,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    recipe_count, meal_count, protocol_count,
    jsonb_build_object(
      'scope', effective_scope,
      'affected_recipe_ids', affected_recipe_ids,
      'affected_meal_plan_ids', affected_meal_plan_ids,
      'affected_protocol_ids', affected_protocol_ids
    )
  )
  RETURNING id INTO inserted_replacement_id;

  -- === Audit log ===
  IF current_organization_id IS NOT NULL THEN
    INSERT INTO access_audit_logs (
      organization_id, actor_user_id, action, target_type, target_id, metadata
    )
    VALUES (
      current_organization_id, requesting_user_id,
      'food_reference_replaced', 'food_reference_replacement',
      inserted_replacement_id::TEXT,
      jsonb_build_object(
        'scope', effective_scope,
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
