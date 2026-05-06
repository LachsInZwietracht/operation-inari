import { redirect } from "next/navigation";
import { Activity, AlertTriangle, DatabaseZap, Network, Settings2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { AuthRequiredError, ForbiddenError, requireRole } from "@/lib/auth/access";
import {
  listHl7ImportJobsForAdmin,
  listHl7LabMappingsForAdmin,
  listHl7ReviewResultsForAdmin,
  type Hl7ImportJobAdminRecord,
  type Hl7ImportJobStatus,
  type Hl7ImportResultAdminRecord,
  type Hl7ImportResultStatus,
  type Hl7LabMappingAdminRecord,
  type Hl7LabMappingStatus,
} from "@/lib/data/hl7-admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const JOB_STATUS_LABELS: Record<Hl7ImportJobStatus, string> = {
  received: "Empfangen",
  parsed: "Geparst",
  needs_review: "Pruefung",
  imported: "Importiert",
  failed: "Fehlgeschlagen",
};

const RESULT_STATUS_LABELS: Record<Hl7ImportResultStatus, string> = {
  created: "Angelegt",
  updated: "Aktualisiert",
  skipped: "Uebersprungen",
  needs_review: "Pruefung",
  failed: "Fehlgeschlagen",
};

const JOB_STATUS_BADGES: Record<Hl7ImportJobStatus, string> = {
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  parsed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  needs_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  imported: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  failed: "bg-destructive/15 text-destructive",
};

const RESULT_STATUS_BADGES: Record<Hl7ImportResultStatus, string> = {
  created: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  updated: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  skipped: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
  needs_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  failed: "bg-destructive/15 text-destructive",
};

const MAPPING_STATUS_LABELS: Record<Hl7LabMappingStatus, string> = {
  active: "Aktiv",
  disabled: "Deaktiviert",
};

const MAPPING_STATUS_BADGES: Record<Hl7LabMappingStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  disabled: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getCount(job: Hl7ImportJobAdminRecord, key: string) {
  const counts = job.summary.counts;
  if (!counts || typeof counts !== "object") return 0;
  const value = (counts as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

function getReviewReason(result: Hl7ImportResultAdminRecord) {
  const reason = result.metadata.reason;
  return typeof reason === "string" ? reason : "REVIEW_REQUIRED";
}

function getReviewDetail(result: Hl7ImportResultAdminRecord) {
  const identifier = result.metadata.hl7Identifier;
  const legacyId = result.metadata.legacyId;
  if (typeof identifier === "string") return identifier;
  if (typeof legacyId === "string") return legacyId;
  return result.targetId ?? result.id;
}

function AdminFallback() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrationen"
        description="HL7, SSO und klinische Schnittstellen"
        helpText="Supabase ist lokal nicht konfiguriert. Die Integrationsverwaltung ist verfuegbar, sobald Supabase-Umgebungsvariablen gesetzt sind."
      />
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Lokaler Fallback ist aktiv. Setzen Sie `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`, um Integrationsdaten zu laden.
        </CardContent>
      </Card>
    </div>
  );
}

export default async function AdminIntegrationenPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <AdminFallback />;
  }

  const supabase = await createClient();
  try {
    await requireRole(ADMIN_ROLES, supabase);
  } catch (error) {
    if (error instanceof AuthRequiredError) redirect("/login");
    if (error instanceof ForbiddenError) redirect("/dashboard");
    throw error;
  }

  let jobs: Hl7ImportJobAdminRecord[] = [];
  let reviewResults: Hl7ImportResultAdminRecord[] = [];
  let mappings: Hl7LabMappingAdminRecord[] = [];
  let loadError: string | null = null;

  try {
    [jobs, reviewResults, mappings] = await Promise.all([
      listHl7ImportJobsForAdmin(supabase),
      listHl7ReviewResultsForAdmin(supabase),
      listHl7LabMappingsForAdmin(supabase),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  const needsReviewCount = jobs.filter((job) => job.status === "needs_review").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const activeMappings = mappings.filter((mapping) => mapping.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrationen"
        description="Schnittstellenbetrieb fuer Klinik-IT"
        helpText="Diese Admin-Ansicht startet mit dem HL7-v2-Importstatus und wird als zentrale Flaeche fuer Mappingpflege, Review-Workflows und spaetere FHIR-Syncs ausgebaut."
      />

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="pt-6 text-sm text-destructive">
            Integrationsdaten konnten nicht geladen werden. Bitte Migrationen `20260522000040_hl7_import_mvp.sql` und `20260523000041_sso_group_role_mappings.sql` pruefen. Fehler: {loadError}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">HL7 Jobs</p>
              <p className="text-lg font-semibold">{jobs.length}</p>
            </div>
            <DatabaseZap className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">In Pruefung</p>
              <p className="text-lg font-semibold">{needsReviewCount}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Fehler</p>
              <p className="text-lg font-semibold">{failedCount}</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Aktive Labormappings</p>
              <p className="text-lg font-semibold">{activeMappings}</p>
            </div>
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-muted-foreground" />
            HL7 Import-Jobs
          </CardTitle>
          <CardDescription>Letzte eingegangene ADT-/ORU-Nachrichten mit Importstatus und Ergebniszaehlern.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Nachricht</TableHead>
                  <TableHead>Kontroll-ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Patienten</TableHead>
                  <TableHead>Laborwerte</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(job.createdAt)}</TableCell>
                    <TableCell>{job.sourceSystem}</TableCell>
                    <TableCell>{job.messageType}</TableCell>
                    <TableCell className="font-mono text-xs">{job.messageControlId}</TableCell>
                    <TableCell>
                      <Badge className={JOB_STATUS_BADGES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                    </TableCell>
                    <TableCell>{getCount(job, "patientsCreated") + getCount(job, "patientsUpdated")}</TableCell>
                    <TableCell>{getCount(job, "labValuesCreated")}</TableCell>
                    <TableCell>{getCount(job, "needsReview")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Noch keine HL7-Importjobs fuer diese Organisation.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review-Ergebnisse</CardTitle>
          <CardDescription>Aktuelle HL7-Ergebnisse mit `needs_review` oder `failed` fuer fachliche Nacharbeit.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {reviewResults.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Ziel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Referenz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(result.createdAt)}</TableCell>
                    <TableCell>{result.targetType === "patient" ? "Patient" : "Laborwert"}</TableCell>
                    <TableCell>
                      <Badge className={RESULT_STATUS_BADGES[result.status]}>{RESULT_STATUS_LABELS[result.status]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{getReviewReason(result)}</TableCell>
                    <TableCell className="font-mono text-xs">{getReviewDetail(result)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Keine offenen HL7-Review-Ergebnisse.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">HL7 Labormappings</CardTitle>
          <CardDescription>Aktuelle Zuordnung von HL7-Observation-IDs zu internen Laborparametern.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {mappings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quelle</TableHead>
                  <TableHead>HL7-ID</TableHead>
                  <TableHead>Text</TableHead>
                  <TableHead>Coding</TableHead>
                  <TableHead>Parameter</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>{mapping.sourceSystem}</TableCell>
                    <TableCell className="font-mono text-xs">{mapping.hl7Identifier}</TableCell>
                    <TableCell>{mapping.hl7Text ?? "—"}</TableCell>
                    <TableCell>{mapping.hl7CodingSystem || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{mapping.parameterId}</TableCell>
                    <TableCell>{mapping.unit ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={MAPPING_STATUS_BADGES[mapping.status]}>
                        {MAPPING_STATUS_LABELS[mapping.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Noch keine HL7-Labormappings fuer diese Organisation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
