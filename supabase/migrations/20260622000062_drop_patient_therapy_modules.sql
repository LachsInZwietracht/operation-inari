-- ============================================================================
-- Retire patient therapy modules, device integrations, and PROCAM results
-- ----------------------------------------------------------------------------
-- The "Therapien" tab was removed from the patient workspace to reduce product
-- surface. Nothing reads or writes these tables anymore: the UI panels, the
-- client repositories (patient-therapy-settings-client, patient-therapy-
-- integrations-client, patient-procam-client), the React hooks, and the
-- workspace loader fields were all deleted. The supporting tables are dropped
-- here.
--
-- Originally created in:
--   20260502000018_patient_workspace_persistence.sql
--
-- Indexes, BEFORE UPDATE triggers, and RLS policies are owned by these tables
-- and drop with them. The shared update_updated_at_column() trigger function is
-- still used by other tables and is intentionally left in place.
-- ============================================================================

DROP TABLE IF EXISTS patient_procam_results;
DROP TABLE IF EXISTS patient_therapy_integrations;
DROP TABLE IF EXISTS patient_therapy_settings;
