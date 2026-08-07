"use client";

import { useCallback, useEffect, useState } from "react";

import type { PatientIntakeLink, PatientIntakeSubmission } from "@/lib/types";
import {
  createPatientIntakeLinkClient,
  deletePatientIntakeLinkClient,
  fetchPatientIntakeLinksClient,
  revokePatientIntakeLinkClient,
  type CreatePatientIntakeLinkInput,
} from "@/lib/data/patient-intake-links-client";
import {
  applyPatientIntakeSubmission,
  fetchPatientIntakeSubmissionsClient,
} from "@/lib/data/patient-intake-submissions-client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Intake invitations are server-only from day one — unlike the older workspace
 * hooks there is deliberately no localStorage draft/migration path, because an
 * invitation that only exists in one browser is worthless.
 */
export function usePatientIntake() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<PatientIntakeLink[]>([]);
  const [submissions, setSubmissions] = useState<PatientIntakeSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const [nextLinks, nextSubmissions] = await Promise.all([
        fetchPatientIntakeLinksClient(),
        fetchPatientIntakeSubmissionsClient(),
      ]);
      setLinks(nextLinks);
      setSubmissions(nextSubmissions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // The initial load sets state only after awaiting, so it never triggers a
  // synchronous cascade on mount. `refresh` stays for event-driven reloads.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let cancelled = false;

    void (async () => {
      try {
        const [nextLinks, nextSubmissions] = await Promise.all([
          fetchPatientIntakeLinksClient(),
          fetchPatientIntakeSubmissionsClient(),
        ]);
        if (cancelled) return;
        setLinks(nextLinks);
        setSubmissions(nextSubmissions);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const createLink = useCallback(
    async (input: CreatePatientIntakeLinkInput) => {
      const link = await createPatientIntakeLinkClient(input);
      setLinks((current) => [link, ...current]);
      return link;
    },
    [],
  );

  const revokeLink = useCallback(async (linkId: string) => {
    await revokePatientIntakeLinkClient(linkId);
    setLinks((current) =>
      current.map((link) =>
        link.id === linkId ? { ...link, status: "revoked" as const } : link,
      ),
    );
  }, []);

  const deleteLink = useCallback(async (linkId: string) => {
    await deletePatientIntakeLinkClient(linkId);
    setLinks((current) => current.filter((link) => link.id !== linkId));
    setSubmissions((current) => current.filter((entry) => entry.linkId !== linkId));
  }, []);

  const applySubmission = useCallback(
    async (submissionId: string) => {
      const result = await applyPatientIntakeSubmission(submissionId);
      await refresh();
      return result;
    },
    [refresh],
  );

  const getSubmissionForLink = useCallback(
    (linkId: string) => submissions.find((entry) => entry.linkId === linkId),
    [submissions],
  );

  const getLinksForPatient = useCallback(
    (patientId: string) => links.filter((link) => link.patientId === patientId),
    [links],
  );

  return {
    links,
    submissions,
    isLoading,
    error,
    refresh,
    createLink,
    revokeLink,
    deleteLink,
    applySubmission,
    getSubmissionForLink,
    getLinksForPatient,
  };
}
