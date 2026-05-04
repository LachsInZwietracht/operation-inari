import { redirect } from "next/navigation";
import { KeyRound, Shield, ShieldCheck, Users as UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_ROLES, ROLE_LABELS, hasAnyRole } from "@/lib/auth/rbac";
import {
  AuthRequiredError,
  ForbiddenError,
  ensureCurrentMembership,
  fetchCurrentOrganization,
  fetchOrganizationMemberships,
  requireRole,
} from "@/lib/auth/access";
import { getOrCreateReportRetentionPolicy } from "@/lib/data/report-retention";
import { listSsoConfigs } from "@/lib/data/sso";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, MembershipStatus, OrganizationSsoConfigRecord, SsoConfigStatus, SsoProviderType } from "@/lib/types";
import {
  disableSsoConfigAction,
  inviteTeamMemberAction,
  resendTeamInvitationAction,
  revokeTeamInvitationAction,
  upsertSsoConfigAction,
  updateReportRetentionPolicyAction,
  updateTeamMemberAccessAction,
} from "./actions";

const STATUS_BADGES: Record<MembershipStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  invited: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  disabled: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
};

const ROLE_BADGES: Record<AppRole, string> = {
  owner: "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  dietitian: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  assistant: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
  institution_admin: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
};

const INVITABLE_ROLE_OPTIONS: Array<{ value: Exclude<AppRole, "owner">; label: string }> = [
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "dietitian", label: ROLE_LABELS.dietitian },
  { value: "assistant", label: ROLE_LABELS.assistant },
  { value: "institution_admin", label: ROLE_LABELS.institution_admin },
];

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: "owner", label: ROLE_LABELS.owner },
  ...INVITABLE_ROLE_OPTIONS,
];

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: "Aktiv",
  invited: "Eingeladen",
  disabled: "Deaktiviert",
};

const STATUS_OPTIONS: Array<{ value: MembershipStatus; label: string }> = [
  { value: "active", label: STATUS_LABELS.active },
  { value: "invited", label: STATUS_LABELS.invited },
  { value: "disabled", label: STATUS_LABELS.disabled },
];

const SSO_PROVIDER_LABELS: Record<SsoProviderType, string> = {
  oidc: "OIDC",
  saml: "SAML",
};

const SSO_STATUS_LABELS: Record<SsoConfigStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  disabled: "Deaktiviert",
};

const SSO_STATUS_BADGES: Record<SsoConfigStatus, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  disabled: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
};

function getEditableStatusOptions(status: MembershipStatus) {
  return STATUS_OPTIONS.filter((option) => option.value !== "invited" || status === "invited");
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const successMessage = getSearchParamValue(resolvedSearchParams.success);
  const errorMessage = getSearchParamValue(resolvedSearchParams.error);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Admin & Sicherheit"
          description="Teamverwaltung und Rollenmodell"
          helpText="Supabase ist lokal nicht konfiguriert. Die produktive Teamverwaltung ist verfuegbar, sobald Supabase-Umgebungsvariablen gesetzt sind."
        />
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Lokaler Fallback ist aktiv. Setzen Sie `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`, um RBAC-Daten zu laden.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  try {
    await requireRole(ADMIN_ROLES, supabase);
  } catch (error) {
    if (error instanceof AuthRequiredError) redirect("/login");
    if (error instanceof ForbiddenError) redirect("/dashboard");
    throw error;
  }

  const currentMembership = await ensureCurrentMembership(supabase);
  const [organization, memberships] = await Promise.all([
    fetchCurrentOrganization(supabase, currentMembership.organizationId),
    fetchOrganizationMemberships(supabase, currentMembership.organizationId),
  ]);
  let retentionPolicy = null;
  let retentionPolicyError: string | null = null;
  let ssoConfigs: OrganizationSsoConfigRecord[] = [];
  let ssoConfigError: string | null = null;
  try {
    retentionPolicy = await getOrCreateReportRetentionPolicy(supabase, currentMembership.organizationId);
  } catch (error) {
    retentionPolicyError = (error as Error).message;
  }
  try {
    ssoConfigs = await listSsoConfigs(supabase);
  } catch (error) {
    ssoConfigError = (error as Error).message;
  }
  const primarySsoConfig = ssoConfigs[0];

  const activeCount = memberships.filter((membership) => membership.status === "active").length;
  const adminCount = memberships.filter((membership) => hasAnyRole(membership.role, ADMIN_ROLES)).length;
  const editableRoleOptions = currentMembership.role === "owner"
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value !== "owner");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin & Sicherheit"
        description="Persistierte Teamrollen und Zugriffskontrolle"
        helpText="Diese Ansicht liest Rollen aus Supabase-Teammitgliedschaften. Patientendaten bleiben in dieser RBAC-v1 weiterhin pro Benutzer ueber bestehende RLS-Regeln abgegrenzt."
      />

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CardContent className="pt-6 text-sm text-emerald-900 dark:text-emerald-100">{successMessage}</CardContent>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="pt-6 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Organisation</p>
              <p className="text-lg font-semibold">{organization?.name ?? "Organisation"}</p>
              <p className="text-xs text-muted-foreground">{currentMembership.email}</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <UsersIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Aktive Mitglieder</p>
              <p className="text-lg font-semibold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Aus `organization_memberships` geladen.</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Admin-Rollen</p>
              <p className="text-lg font-semibold">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Owner und Administratoren koennen diese Ansicht sehen.</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teammitglied einladen</CardTitle>
          <CardDescription>
            Einladungen nutzen die Supabase Admin API, legen einen eingeladenen Auth-Benutzer an und persistieren die Mitgliedschaft mit Status `invited`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteTeamMemberAction} className="grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-Mail</Label>
              <Input id="invite-email" name="email" type="email" placeholder="name@klinik.de" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-display-name">Name</Label>
              <Input id="invite-display-name" name="displayName" placeholder="Optionaler Anzeigename" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rolle</Label>
              <select
                id="invite-role"
                name="role"
                defaultValue="dietitian"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs"
              >
                {INVITABLE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Einladen</Button>
            </div>
          </form>
          {!process.env.SUPABASE_SERVICE_ROLE_KEY ? (
            <p className="mt-3 text-xs text-amber-700">
              `SUPABASE_SERVICE_ROLE_KEY` fehlt. Das Formular bleibt sichtbar, aber Einladungen koennen erst mit Server-Schluessel versendet werden.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teammitglieder</CardTitle>
          <CardDescription>
            Persistierte Rollenbasis fuer Route- und API-Zugriff. Rollen- und Statuswechsel werden auditiert und gegen Owner-Lockout geprueft.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seit</TableHead>
                <TableHead>Einladung</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => {
                const protectedOwnerRow = membership.role === "owner" && currentMembership.role !== "owner";
                const editableStatusOptions = getEditableStatusOptions(membership.status);

                return (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium">{membership.displayName ?? "Ohne Namen"}</TableCell>
                    <TableCell>{membership.email}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_BADGES[membership.role]}>{ROLE_LABELS[membership.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGES[membership.status]}>{STATUS_LABELS[membership.status]}</Badge>
                    </TableCell>
                    <TableCell>{new Date(membership.joinedAt ?? membership.createdAt).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>
                      {membership.invitationSentAt ? (
                        <div className="text-sm">
                          <p>{new Date(membership.invitationSentAt).toLocaleDateString("de-DE")}</p>
                          {membership.invitationExpiresAt ? (
                            <p className="text-xs text-muted-foreground">
                              bis {new Date(membership.invitationExpiresAt).toLocaleDateString("de-DE")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[360px]">
                      <div className="flex flex-wrap justify-end gap-2">
                        {protectedOwnerRow ? (
                          <span className="self-center text-sm text-muted-foreground">Owner geschuetzt</span>
                        ) : (
                          <form action={updateTeamMemberAccessAction} className="flex flex-wrap justify-end gap-2">
                            <input type="hidden" name="membershipId" value={membership.id} />
                            <select
                              name="role"
                              defaultValue={membership.role}
                              aria-label={`Rolle fuer ${membership.email}`}
                              className="border-input bg-background h-9 w-[170px] rounded-md border px-3 text-sm shadow-xs"
                            >
                              {editableRoleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <select
                              name="status"
                              defaultValue={membership.status}
                              aria-label={`Status fuer ${membership.email}`}
                              className="border-input bg-background h-9 w-[130px] rounded-md border px-3 text-sm shadow-xs"
                            >
                              {editableStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm">Speichern</Button>
                          </form>
                        )}
                        {membership.status !== "active" ? (
                          <>
                            <form action={resendTeamInvitationAction}>
                              <input type="hidden" name="membershipId" value={membership.id} />
                              <Button type="submit" size="sm" variant="outline">Erneut senden</Button>
                            </form>
                            {membership.status === "invited" ? (
                              <form action={revokeTeamInvitationAction}>
                                <input type="hidden" name="membershipId" value={membership.id} />
                                <Button type="submit" size="sm" variant="ghost">Widerrufen</Button>
                              </form>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            SSO-Konfiguration
          </CardTitle>
          <CardDescription>
            Persistiert OIDC-/SAML-Metadaten und E-Mail-Domains fuer Klinik-Login-Routing. Der Provider-Handoff selbst bleibt bewusst separat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ssoConfigError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
              SSO-Konfigurationen konnten nicht geladen werden. Bitte Migration `20260521000039_sso_configs.sql` anwenden. Fehler: {ssoConfigError}
            </div>
          ) : null}

          <form action={upsertSsoConfigAction} className="space-y-4">
            <input type="hidden" name="configId" value={primarySsoConfig?.id ?? ""} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="sso-display-name">Anzeigename</Label>
                <Input
                  id="sso-display-name"
                  name="displayName"
                  defaultValue={primarySsoConfig?.displayName ?? "Klinik SSO"}
                  placeholder="Azure AD Klinik"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-provider-type">Provider</Label>
                <select
                  id="sso-provider-type"
                  name="providerType"
                  defaultValue={primarySsoConfig?.providerType ?? "oidc"}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs"
                >
                  <option value="oidc">OIDC</option>
                  <option value="saml">SAML</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-status">Status</Label>
                <select
                  id="sso-status"
                  name="status"
                  defaultValue={primarySsoConfig?.status ?? "draft"}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs"
                >
                  <option value="draft">Entwurf</option>
                  <option value="active">Aktiv</option>
                  <option value="disabled">Deaktiviert</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-login-hint">Login-Hint Parameter</Label>
                <Input
                  id="sso-login-hint"
                  name="loginHintParameter"
                  defaultValue={primarySsoConfig?.loginHintParameter ?? "login_hint"}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sso-domains">E-Mail-Domains</Label>
                <Textarea
                  id="sso-domains"
                  name="domains"
                  defaultValue={primarySsoConfig?.domains.join("\n") ?? "klinik.example"}
                  placeholder="klinik.de&#10;partner-klinik.de"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sso-issuer-url">Issuer URL</Label>
                  <Input id="sso-issuer-url" name="issuerUrl" defaultValue={primarySsoConfig?.issuerUrl ?? ""} placeholder="https://login.microsoftonline.com/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-metadata-url">Metadata URL</Label>
                  <Input id="sso-metadata-url" name="metadataUrl" defaultValue={primarySsoConfig?.metadataUrl ?? ""} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-client-id">Client ID</Label>
                  <Input id="sso-client-id" name="clientId" defaultValue={primarySsoConfig?.clientId ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-entity-id">Entity ID</Label>
                  <Input id="sso-entity-id" name="entityId" defaultValue={primarySsoConfig?.entityId ?? ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sso-url">SAML SSO URL</Label>
                  <Input id="sso-url" name="ssoUrl" defaultValue={primarySsoConfig?.ssoUrl ?? ""} placeholder="https://idp.example/sso" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-metadata-xml">SAML Metadata XML</Label>
              <Textarea
                id="sso-metadata-xml"
                name="metadataXml"
                defaultValue={primarySsoConfig?.metadataXml ?? ""}
                placeholder="<EntityDescriptor ...>"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">SSO-Konfiguration speichern</Button>
              {primarySsoConfig && primarySsoConfig.status !== "disabled" ? (
                <Button type="submit" variant="outline" form="disable-sso-config-form">SSO deaktivieren</Button>
              ) : null}
            </div>
          </form>
          {primarySsoConfig && primarySsoConfig.status !== "disabled" ? (
            <form id="disable-sso-config-form" action={disableSsoConfigAction}>
              <input type="hidden" name="configId" value={primarySsoConfig.id} />
            </form>
          ) : null}

          {ssoConfigs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Domains</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktualisiert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ssoConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.displayName}</TableCell>
                      <TableCell>{SSO_PROVIDER_LABELS[config.providerType]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{config.domains.join(", ")}</TableCell>
                      <TableCell>
                        <Badge className={SSO_STATUS_BADGES[config.status]}>{SSO_STATUS_LABELS[config.status]}</Badge>
                      </TableCell>
                      <TableCell>{new Date(config.updatedAt).toLocaleDateString("de-DE")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Noch keine SSO-Konfiguration gespeichert.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Berichtsaufbewahrung</CardTitle>
          <CardDescription>
            Admin-Steuerung fuer patientengebundene Berichtsversionen. Neue PDF-/CSV-Exporte erhalten diese Policy als Aufbewahrungsfrist und Archivmetadaten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {retentionPolicyError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
              Retention-Policy konnte nicht geladen werden. Bitte Migration `20260517000035_report_retention_policies.sql` anwenden. Fehler: {retentionPolicyError}
            </div>
          ) : (
            <form action={updateReportRetentionPolicyAction} className="grid gap-4 lg:grid-cols-[1fr_160px]">
              <input type="hidden" name="policyId" value={retentionPolicy?.id ?? ""} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retention-name">Policy-Name</Label>
                  <Input
                    id="retention-name"
                    name="name"
                    defaultValue={retentionPolicy?.name ?? "Standard-Aufbewahrung"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retention-years">Aufbewahrung in Jahren</Label>
                  <Input
                    id="retention-years"
                    name="retentionYears"
                    type="number"
                    min={1}
                    max={30}
                    defaultValue={retentionPolicy?.retentionYears ?? 10}
                  />
                </div>
                <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <input
                    name="requireAdminApproval"
                    type="checkbox"
                    defaultChecked={retentionPolicy?.requireAdminApproval ?? true}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Admin-Freigabe vor Loeschung</span>
                    <span className="text-xs text-muted-foreground">Abgelaufene Berichte gehen zuerst in die Loeschpruefung.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <input
                    name="autoDeleteEnabled"
                    type="checkbox"
                    defaultChecked={retentionPolicy?.autoDeleteEnabled ?? false}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Automatische Loeschpruefung</span>
                    <span className="text-xs text-muted-foreground">Aktiviert nur die Policy-Markierung; ein Scheduler bleibt separat.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <input
                    name="legalHoldEnabled"
                    type="checkbox"
                    defaultChecked={retentionPolicy?.legalHoldEnabled ?? false}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Legal Hold aktivierbar</span>
                    <span className="text-xs text-muted-foreground">Neue Berichtsversionen werden mit Sperrstatus archiviert.</span>
                  </span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="retention-notes">Hinweise</Label>
                  <Input
                    id="retention-notes"
                    name="notes"
                    defaultValue={retentionPolicy?.notes ?? "Standard fuer patientengebundene Berichte."}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Policy speichern</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          RBAC-v1 schuetzt sensible Bereiche und speichert Teamrollen. Vollstaendige Team-Freigabe fuer Patientenakten ist bewusst noch nicht aktiviert; bestehende Patientendaten bleiben `user_id`-gebunden.
        </CardContent>
      </Card>
    </div>
  );
}
