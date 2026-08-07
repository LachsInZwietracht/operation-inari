-- ============================================================================
-- Patient intake links (onboarding invitations)
-- ============================================================================
-- A practitioner creates an invitation, shares the resulting URL/QR code, and
-- the invited person fills in the public intake form at /onboarding/[linkId].
--
-- `patient_id` is intentionally NULLABLE:
--   NULL     -> new person; the patient record is created when the practitioner
--               applies the submission.
--   NOT NULL -> re-onboarding of an existing patient; the submission updates it.
--
-- No `url` column: the public URL is always derived as `${origin}/onboarding/${id}`.
-- No `qr_code` column: QR codes are rendered on demand and never stored
-- (see 20260624000001 and 20260625000063, which removed stored QR payloads).

CREATE TABLE patient_intake_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'expired', 'revoked')),
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_intake_links_user_id_updated_at_idx
  ON patient_intake_links(user_id, updated_at DESC);
CREATE INDEX patient_intake_links_patient_id_idx
  ON patient_intake_links(patient_id);

CREATE TRIGGER patient_intake_links_updated_at
  BEFORE UPDATE ON patient_intake_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──
-- Policies key off user_id, never patient_id, because patient_id may be NULL.
ALTER TABLE patient_intake_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own intake links"
  ON patient_intake_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intake links"
  ON patient_intake_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intake links"
  ON patient_intake_links FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own intake links"
  ON patient_intake_links FOR DELETE
  USING (auth.uid() = user_id);

-- No anon policy: the public onboarding page reads through the service role.
