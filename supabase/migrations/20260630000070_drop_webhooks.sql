-- ============================================================================
-- Drop outbound webhooks feature
--
-- Removes the webhook endpoints and their delivery-attempt queue together with
-- RLS policies, triggers, and indexes. The webhooks admin surface (the
-- Integrationen tab in /api-export), API routes, data layer, and the
-- export/protocol enqueue side effects were removed from the application; these
-- tables are no longer read or written.
--
-- CASCADE drops the dependent policies, triggers, indexes, and foreign keys.
-- ============================================================================

DROP TABLE IF EXISTS webhook_delivery_attempts CASCADE;
DROP TABLE IF EXISTS webhook_endpoints CASCADE;
