-- ============================================================================
-- Close client_patient_history() to anonymous callers.
--
-- Migration 75 revoked from PUBLIC and granted to `authenticated`, which read
-- as "only signed-in users may call this". It was not: Supabase's default
-- privileges grant EXECUTE on new functions in `public` directly to `anon`,
-- and a REVOKE from PUBLIC does not touch a grant held by a named role.
--
-- Nothing leaked — without a JWT `auth.uid()` is NULL, no link matches and the
-- function returns NULL — but a function about one specific person should not
-- be callable by someone who is not anyone. Revoked explicitly so the grant
-- matches the intent rather than relying on the body to be empty.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.client_patient_history() FROM anon;
