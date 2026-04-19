-- Digital protocol submissions: stores patient-submitted meal data
CREATE TABLE digital_protocol_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES patient_digital_protocol_links(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'converted')),
  converted_protocol_id UUID REFERENCES nutrition_protocols(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX digital_protocol_submissions_link_id_idx
  ON digital_protocol_submissions(link_id);
CREATE INDEX digital_protocol_submissions_patient_id_created_at_idx
  ON digital_protocol_submissions(patient_id, created_at DESC);

CREATE TRIGGER digital_protocol_submissions_updated_at
  BEFORE UPDATE ON digital_protocol_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE digital_protocol_submissions ENABLE ROW LEVEL SECURITY;

-- Practitioners can read submissions for their own protocol links
CREATE POLICY "digital_protocol_submissions_read_own" ON digital_protocol_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_digital_protocol_links
      WHERE patient_digital_protocol_links.id = digital_protocol_submissions.link_id
        AND patient_digital_protocol_links.user_id = auth.uid()
    )
  );

-- Practitioners can update submission status
CREATE POLICY "digital_protocol_submissions_update_own" ON digital_protocol_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patient_digital_protocol_links
      WHERE patient_digital_protocol_links.id = digital_protocol_submissions.link_id
        AND patient_digital_protocol_links.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_digital_protocol_links
      WHERE patient_digital_protocol_links.id = digital_protocol_submissions.link_id
        AND patient_digital_protocol_links.user_id = auth.uid()
    )
  );

-- No anon INSERT policy — inserts go through service role API
