-- ============================================================================
-- Let a counselor edit the principles a plan is judged by.
--
-- The principles are derived: energy from the calorie goal, protein from the
-- macro split, fibre from the DGE reference. That keeps every rule traceable,
-- and it also means a counselor could not raise a protein target for one
-- patient without changing the split for every plan they will ever get.
--
-- This column holds only the differences — which derived rules were hidden,
-- which targets were replaced, and which rules the counselor wrote themselves.
-- Absent or NULL is the normal state and leaves the derivation untouched.
-- ============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS plan_principles JSONB;

COMMENT ON COLUMN public.patients.plan_principles IS
  'Counselor overrides on the derived plan principles: {hidden: string[], targets: Record<string, number>, custom: {id, text}[]}. NULL keeps the derivation.';
