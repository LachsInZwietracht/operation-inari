-- Collapse patient reports to one standardised Bericht per patient.
-- Drops denormalised columns whose values were only ever needed to describe
-- variant reports (Kurzbericht/Vollversion, section toggles, free-form title)
-- and enforces a uniqueness constraint on (user_id, patient_ref).

-- Mock data only: clear existing rows so the new uniqueness constraint can be
-- applied cleanly. Storage objects in `patient-report-files` are orphaned and
-- can be ignored for the dev/demo dataset.
DELETE FROM patient_report_versions;
DELETE FROM patient_reports;

ALTER TABLE patient_reports
  DROP COLUMN title,
  DROP COLUMN report_length,
  DROP COLUMN selected_sections,
  DROP COLUMN active_section_labels;

ALTER TABLE patient_report_versions
  DROP COLUMN title;

CREATE UNIQUE INDEX patient_reports_user_patient_unique
  ON patient_reports(user_id, patient_ref);
