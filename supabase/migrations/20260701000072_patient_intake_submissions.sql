-- ============================================================================
-- Patient intake submissions
-- ============================================================================
-- Stores the raw, validated payload submitted through a public intake link.
-- Nothing is written to `patients`, `patient_allergens` or
-- `patient_food_preferences` until the practitioner explicitly applies the
-- submission, mirroring the digital protocol submission review flow.

CREATE TABLE patient_intake_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES patient_intake_links(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'applied')),
  applied_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One submission per invitation.
CREATE UNIQUE INDEX patient_intake_submissions_link_id_key
  ON patient_intake_submissions(link_id);

CREATE INDEX patient_intake_submissions_patient_id_created_at_idx
  ON patient_intake_submissions(patient_id, created_at DESC);

CREATE TRIGGER patient_intake_submissions_updated_at
  BEFORE UPDATE ON patient_intake_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──
ALTER TABLE patient_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_intake_submissions_read_own" ON patient_intake_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_intake_links
      WHERE patient_intake_links.id = patient_intake_submissions.link_id
        AND patient_intake_links.user_id = auth.uid()
    )
  );

CREATE POLICY "patient_intake_submissions_update_own" ON patient_intake_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patient_intake_links
      WHERE patient_intake_links.id = patient_intake_submissions.link_id
        AND patient_intake_links.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_intake_links
      WHERE patient_intake_links.id = patient_intake_submissions.link_id
        AND patient_intake_links.user_id = auth.uid()
    )
  );

CREATE POLICY "patient_intake_submissions_delete_own" ON patient_intake_submissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM patient_intake_links
      WHERE patient_intake_links.id = patient_intake_submissions.link_id
        AND patient_intake_links.user_id = auth.uid()
    )
  );

-- No anon INSERT policy — inserts go through the service-role API route.
