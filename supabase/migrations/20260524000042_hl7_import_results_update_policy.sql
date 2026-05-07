CREATE POLICY "hl7_import_results_update_admin" ON hl7_import_results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM hl7_import_jobs
      WHERE hl7_import_jobs.id = hl7_import_results.job_id
        AND is_organization_admin(hl7_import_jobs.organization_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hl7_import_jobs
      WHERE hl7_import_jobs.id = hl7_import_results.job_id
        AND is_organization_admin(hl7_import_jobs.organization_id, auth.uid())
    )
  );
