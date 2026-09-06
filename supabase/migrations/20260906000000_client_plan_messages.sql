-- Requests never mutate a released plan. Snapshots preserve their original context.
CREATE TABLE public.client_plan_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.client_links(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  meal_plan_id uuid NOT NULL REFERENCES public.daily_meal_plans(id) ON DELETE CASCADE,
  meal_entry_id uuid,
  ingredient_id uuid,
  plan_date date NOT NULL,
  revision_number integer NOT NULL,
  target_label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('alternative', 'feedback')),
  body text NOT NULL CHECK (length(body) <= 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  response text CHECK (length(response) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((kind = 'alternative' AND meal_entry_id IS NOT NULL) OR
         (kind = 'feedback' AND meal_entry_id IS NULL AND ingredient_id IS NULL AND length(trim(body)) > 0))
);
CREATE UNIQUE INDEX client_plan_messages_open_target ON public.client_plan_messages
  (link_id, meal_entry_id, coalesce(ingredient_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE kind = 'alternative' AND status = 'open';
CREATE INDEX client_plan_messages_patient ON public.client_plan_messages(patient_id, created_at DESC);
CREATE INDEX client_plan_messages_link ON public.client_plan_messages(link_id);
ALTER TABLE public.client_plan_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_plan_messages_read ON public.client_plan_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.client_links l WHERE l.id = link_id AND l.status = 'active'
    AND l.patient_id = client_plan_messages.patient_id AND l.consent_nutrition
    AND (l.client_user_id = auth.uid() OR l.counselor_user_id = auth.uid()))
);
REVOKE ALL ON public.client_plan_messages FROM anon, authenticated;
GRANT SELECT ON public.client_plan_messages TO authenticated;

CREATE FUNCTION public.send_client_plan_message(
  p_plan_id uuid, p_body text, p_entry_id uuid DEFAULT NULL, p_ingredient_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  p public.daily_meal_plans%ROWTYPE;
  e public.meal_entries%ROWTYPE;
  l public.client_links%ROWTYPE;
  label text;
  ingredient_label text;
  result uuid;
BEGIN
  SELECT * INTO p FROM public.daily_meal_plans WHERE id = p_plan_id FOR SHARE;
  IF NOT FOUND OR p.status NOT IN ('active', 'approved') THEN RAISE EXCEPTION 'PLAN_NOT_RELEASED'; END IF;
  SELECT * INTO l FROM public.client_links WHERE patient_id = p.patient_id
    AND counselor_user_id = p.user_id AND client_user_id = auth.uid()
    AND status = 'active' AND consent_nutrition FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_NUTRITION_LINK_REQUIRED'; END IF;
  IF p_body IS NULL OR length(p_body) > 3000 THEN RAISE EXCEPTION 'INVALID_BODY'; END IF;
  IF p_entry_id IS NOT NULL THEN
    SELECT * INTO e FROM public.meal_entries WHERE id = p_entry_id AND meal_plan_id = p.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
    IF e.entry_type = 'recipe' THEN SELECT name INTO label FROM public.recipes WHERE id = e.reference_id;
    ELSE SELECT name INTO label FROM public.foods WHERE id = e.reference_id; END IF;
    IF p_ingredient_id IS NOT NULL THEN
      IF e.entry_type <> 'recipe' THEN RAISE EXCEPTION 'INVALID_INGREDIENT'; END IF;
      SELECT f.name INTO ingredient_label FROM public.recipe_ingredients i
        JOIN public.foods f ON f.id = i.food_id WHERE i.id = p_ingredient_id AND i.recipe_id = e.reference_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_INGREDIENT'; END IF;
      label := label || ' · Zutat: ' || ingredient_label;
    END IF;
  ELSE
    IF p_ingredient_id IS NOT NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'INVALID_FEEDBACK'; END IF;
    label := coalesce(p.title, 'Ernährungsplan');
  END IF;
  INSERT INTO public.client_plan_messages(link_id, patient_id, meal_plan_id, meal_entry_id, ingredient_id,
    plan_date, revision_number, target_label, kind, body)
  VALUES (l.id, p.patient_id, p.id, p_entry_id, p_ingredient_id, p.date, p.revision_number,
    coalesce(label, 'Planeintrag'), CASE WHEN p_entry_id IS NULL THEN 'feedback' ELSE 'alternative' END, trim(p_body))
  ON CONFLICT DO NOTHING RETURNING id INTO result;
  IF result IS NULL THEN
    SELECT id INTO result FROM public.client_plan_messages WHERE link_id = l.id AND meal_entry_id = p_entry_id
      AND ingredient_id IS NOT DISTINCT FROM p_ingredient_id AND kind = 'alternative' AND status = 'open';
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.resolve_client_plan_message(p_id uuid, p_response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_response IS NULL OR length(trim(p_response)) = 0 OR length(p_response) > 2000 THEN
    RAISE EXCEPTION 'RESPONSE_REQUIRED';
  END IF;
  PERFORM 1 FROM public.client_links l JOIN public.client_plan_messages m ON m.link_id = l.id
    JOIN public.daily_meal_plans p ON p.id = m.meal_plan_id
    WHERE m.id = p_id AND l.counselor_user_id = auth.uid() AND p.user_id = auth.uid()
      AND l.patient_id = m.patient_id AND l.status = 'active' AND l.consent_nutrition FOR SHARE OF l;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  UPDATE public.client_plan_messages SET status = 'resolved', response = trim(p_response), resolved_at = now()
    WHERE id = p_id AND status = 'open';
END $$;
REVOKE ALL ON FUNCTION public.send_client_plan_message(uuid,text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_client_plan_message(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_client_plan_message(uuid,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_client_plan_message(uuid,text) TO authenticated;

-- Only labels and ingredient identities, never private food/recipe metadata.
-- This also covers counselor-owned custom foods that the catalog RLS hides.
CREATE FUNCTION public.get_client_plan_targets(p_plan_id uuid)
RETURNS TABLE(entry_id uuid, label text, ingredients jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.daily_meal_plans p WHERE p.id = p_plan_id
    AND p.status IN ('active', 'approved') AND public.client_can_read_patient_plans(p.patient_id))
  THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  RETURN QUERY SELECT e.id,
    CASE WHEN e.entry_type = 'food' THEN coalesce(f.name, 'Lebensmittel') ELSE coalesce(r.name, 'Rezept') END,
    CASE WHEN e.entry_type = 'recipe' THEN coalesce((SELECT jsonb_agg(
      jsonb_build_object('id', i.id, 'name', ingredient_food.name) ORDER BY i.sort_order, i.id)
      FROM public.recipe_ingredients i JOIN public.foods ingredient_food ON ingredient_food.id = i.food_id
      WHERE i.recipe_id = e.reference_id), '[]'::jsonb) ELSE '[]'::jsonb END
  FROM public.meal_entries e
  LEFT JOIN public.foods f ON e.entry_type = 'food' AND f.id = e.reference_id
  LEFT JOIN public.recipes r ON e.entry_type = 'recipe' AND r.id = e.reference_id
  WHERE e.meal_plan_id = p_plan_id;
END $$;
REVOKE ALL ON FUNCTION public.get_client_plan_targets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_plan_targets(uuid) TO authenticated;
