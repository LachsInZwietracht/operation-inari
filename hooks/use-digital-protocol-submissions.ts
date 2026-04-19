"use client";

import { useCallback, useEffect, useState } from "react";

import type { DigitalProtocolSubmission } from "@/lib/types";
import {
  completeSubmissionConversionClient,
  fetchSubmissionByIdClient,
  fetchSubmissionsForPatientClient,
  updateSubmissionStatusClient,
} from "@/lib/data/digital-protocol-submissions-client";
import { useAuth } from "@/hooks/use-auth";

export function useDigitalProtocolSubmissions(patientId: string) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<DigitalProtocolSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoading(true);

    async function load() {
      try {
        const data = await fetchSubmissionsForPatientClient(patientId);
        if (!cancelled) setSubmissions(data);
      } catch (error) {
        console.error("Failed to fetch protocol submissions:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, isAuthenticated, authLoading]);

  const updateStatus = useCallback(
    async (submissionId: string, status: DigitalProtocolSubmission["status"]) => {
      try {
        await updateSubmissionStatusClient(submissionId, status);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId
              ? { ...s, status, updatedAt: new Date().toISOString() }
              : s
          )
        );
      } catch (error) {
        console.error("Failed to update submission status:", error);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await fetchSubmissionsForPatientClient(patientId);
      setSubmissions(data);
    } catch (error) {
      console.error("Failed to refresh protocol submissions:", error);
    }
  }, [patientId, isAuthenticated]);

  const getSubmission = useCallback(
    (submissionId: string) =>
      submissions.find((submission) => submission.id === submissionId),
    [submissions]
  );

  const loadSubmission = useCallback(
    async (submissionId: string) => {
      if (!isAuthenticated) return null;
      try {
        return await fetchSubmissionByIdClient(submissionId);
      } catch (error) {
        console.error("Failed to load protocol submission:", error);
        return null;
      }
    },
    [isAuthenticated]
  );

  const markConverted = useCallback(
    async (submissionId: string, protocolId: string) => {
      const updated = await completeSubmissionConversionClient(submissionId, protocolId);
      setSubmissions((prev) =>
        prev.map((submission) => (submission.id === submissionId ? updated : submission))
      );
      return updated;
    },
    []
  );

  return { submissions, isLoading, updateStatus, refresh, getSubmission, loadSubmission, markConverted };
}
