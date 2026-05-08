-- ============================================================================
-- Patient intake extensions
-- ============================================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived', 'deceased')),
  ADD COLUMN IF NOT EXISTS care_setting TEXT NOT NULL DEFAULT 'ambulatory'
    CHECK (care_setting IN ('ambulatory', 'inpatient', 'discharged')),
  ADD COLUMN IF NOT EXISTS external_patient_number TEXT,
  ADD COLUMN IF NOT EXISTS case_number TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact_channel TEXT
    CHECK (preferred_contact_channel IN ('phone', 'email', 'mail', 'none')),
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS communication_consent BOOLEAN,
  ADD COLUMN IF NOT EXISTS digital_protocol_consent BOOLEAN,
  ADD COLUMN IF NOT EXISTS referrer_name TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS intake_reason TEXT,
  ADD COLUMN IF NOT EXISTS patient_goals TEXT,
  ADD COLUMN IF NOT EXISTS clinical_notes TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

CREATE INDEX IF NOT EXISTS patients_status_idx ON patients(user_id, status);
CREATE INDEX IF NOT EXISTS patients_care_setting_idx ON patients(user_id, care_setting);
CREATE INDEX IF NOT EXISTS patients_external_patient_number_idx ON patients(user_id, external_patient_number);
CREATE INDEX IF NOT EXISTS patients_case_number_idx ON patients(user_id, case_number);
