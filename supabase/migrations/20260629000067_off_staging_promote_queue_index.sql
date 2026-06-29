-- ============================================================================
-- Partial index for the OFF promote queue.
--
-- promoteValidatedProducts() repeatedly fetches the next batch of validated,
-- not-yet-promoted staging rows. Without a supporting index this is a sequential
-- scan over off_staging that has to skip past every already-promoted row, so it
-- degrades as the run progresses — a full German import (~220k promotions) hit
-- Postgres' statement timeout around 90k promoted and aborted.
--
-- A partial index over only the unpromoted, validated rows keeps each fetch fast
-- and roughly constant-time: rows leave the index as they flip to promoted=true.
-- Indexing on data_quality_score also covers the `>= OFF_MIN_QUALITY_SCORE`
-- predicate.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_off_staging_promote_queue
  ON off_staging (data_quality_score)
  WHERE validated AND NOT promoted;
