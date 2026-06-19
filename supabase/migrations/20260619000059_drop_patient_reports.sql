-- ============================================================================
-- Drop the patient-report (Berichte) feature
-- ============================================================================
-- The Berichte surface (per-patient report browsing/versioning) has been
-- removed from the app in favour of the new Statistiken tab. The shared
-- /api/exports/report endpoint still generates plan PDF/CSV files for the
-- Ernaehrungsplan editor, but no longer persists patient-report records.
--
-- This migration removes the now-unused storage and tables. The shared
-- report_retention_policies table is intentionally kept (used by admin).

-- Storage policies for archived report files. (The `patient-report-files`
-- bucket and any remaining objects must be removed via the Storage API/dashboard
-- -- managed Postgres blocks direct DELETE on storage.objects/storage.buckets.)
DROP POLICY IF EXISTS "patient_report_files_read_own" ON storage.objects;
DROP POLICY IF EXISTS "patient_report_files_insert_own" ON storage.objects;

-- Report tables (versions reference reports, drop with CASCADE for safety).
DROP TABLE IF EXISTS patient_report_versions CASCADE;
DROP TABLE IF EXISTS patient_reports CASCADE;
