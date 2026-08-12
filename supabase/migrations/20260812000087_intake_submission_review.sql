-- Practitioner review state for patient intake submissions.
--
-- A submission can now be corrected before apply, carry an internal review
-- note, or be discarded without deleting the original patient response.

ALTER TABLE patient_intake_submissions
  DROP CONSTRAINT IF EXISTS patient_intake_submissions_status_check;

ALTER TABLE patient_intake_submissions
  ADD CONSTRAINT patient_intake_submissions_status_check
  CHECK (status IN ('new', 'reviewed', 'applied', 'discarded'));

ALTER TABLE patient_intake_submissions
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN patient_intake_submissions.reviewer_notes IS
  'Internal practitioner note recorded while reviewing the submitted intake.';
COMMENT ON COLUMN patient_intake_submissions.reviewed_at IS
  'When the practitioner applied or discarded the reviewed submission.';
COMMENT ON COLUMN patient_intake_submissions.reviewed_by IS
  'Practitioner who applied or discarded the reviewed submission.';
