-- ============================================================================
-- Drop HL7 v2 import feature
--
-- Removes the HL7 lab-import pipeline (import jobs, results, and lab-parameter
-- mappings) together with its RLS policies, triggers, and indexes. The feature
-- and its admin surface (/admin/integrationen), API routes, and API-key scope
-- were removed from the application; these tables are no longer read or written.
--
-- CASCADE drops the dependent policies, triggers, indexes, and foreign keys.
-- ============================================================================

DROP TABLE IF EXISTS hl7_import_results CASCADE;
DROP TABLE IF EXISTS hl7_import_jobs CASCADE;
DROP TABLE IF EXISTS hl7_lab_parameter_mappings CASCADE;
