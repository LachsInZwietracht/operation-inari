-- A template may either be reusable across a counselor's own patients or be
-- deliberately bound to one of that counselor's patients. Existing system
-- rows remain intact for backwards compatibility, but are no longer surfaced
-- by the counselor workflow.

ALTER TABLE meal_plan_templates
  ADD COLUMN patient_id UUID REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE meal_plan_templates
  ADD CONSTRAINT meal_plan_templates_patient_scope_check
  CHECK (
    patient_id IS NULL
    OR (user_id IS NOT NULL AND source_type = 'personal')
  );

CREATE INDEX meal_plan_templates_personal_patient_name_idx
  ON meal_plan_templates(user_id, patient_id, name)
  WHERE source_type = 'personal';

-- Owning a template is not enough when it is patient-bound: the selected
-- patient must belong to the same authenticated counselor as well.
DROP POLICY "meal_plan_templates_insert_own" ON meal_plan_templates;
DROP POLICY "meal_plan_templates_update_own" ON meal_plan_templates;
DROP POLICY "meal_plan_templates_read_own" ON meal_plan_templates;

CREATE POLICY "meal_plan_templates_read_own" ON meal_plan_templates
  FOR SELECT USING (
    user_id = auth.uid()
    AND (
      patient_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM patients
        WHERE patients.id = meal_plan_templates.patient_id
          AND patients.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "meal_plan_templates_insert_own" ON meal_plan_templates
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      patient_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM patients
        WHERE patients.id = meal_plan_templates.patient_id
          AND patients.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "meal_plan_templates_update_own" ON meal_plan_templates
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      patient_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM patients
        WHERE patients.id = meal_plan_templates.patient_id
          AND patients.user_id = auth.uid()
      )
    )
  );
