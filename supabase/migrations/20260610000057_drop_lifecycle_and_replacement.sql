-- ============================================================================
-- Retire database lifecycle events and food reference replacement
-- ----------------------------------------------------------------------------
-- These features were removed from the product surface (the `/datenbank`
-- history timeline, the in-page replacement form, and the `/api/foods/replace`
-- endpoint). Nothing reads `data_source_events` anymore and no client calls the
-- replacement RPC, so the supporting database objects are dropped here.
--
-- Originally created in:
--   20260512000029_database_lifecycle.sql
--   20260516000034_food_replacement_org_scope.sql
-- ============================================================================

-- Drop the replacement RPC (both the original 3-arg and the scope-aware 4-arg
-- signatures, in case either is present in a given environment).
DROP FUNCTION IF EXISTS replace_food_references(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS replace_food_references(UUID, UUID, TEXT);

-- Drop the audit/log tables (indexes and RLS policies drop with the tables).
DROP TABLE IF EXISTS food_reference_replacements;
DROP TABLE IF EXISTS data_source_events;
