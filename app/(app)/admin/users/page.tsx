import { redirect } from "next/navigation";
import { Shield, ShieldCheck, Users as UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_ROLES, ROLE_LABELS, hasAnyRole } from "@/lib/auth/rbac";
import {
  AuthRequiredError,
  ForbiddenError,
  ensureCurrentMembership,
  fetchCurrentOrganization,
  fetchOrganizationMemberships,
  requireRole,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, MembershipStatus } from "@/lib/types";

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

export default async function AdminUsersPage() {
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

  const activeCount = memberships.filter((membership) => membership.status === "active").length;
  const adminCount = memberships.filter((membership) => hasAnyRole(membership.role, ADMIN_ROLES)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin & Sicherheit"
        description="Persistierte Teamrollen und Zugriffskontrolle"
        helpText="Diese Ansicht liest Rollen aus Supabase-Teammitgliedschaften. Patientendaten bleiben in dieser RBAC-v1 weiterhin pro Benutzer ueber bestehende RLS-Regeln abgegrenzt."
      />

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
          <CardTitle className="text-base">Teammitglieder</CardTitle>
          <CardDescription>
            Persistierte Rollenbasis fuer Route- und API-Zugriff. Einladung und Rollenwechsel werden auf dieser Grundlage als naechster Schritt umgesetzt.
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => (
                <TableRow key={membership.id}>
                  <TableCell className="font-medium">{membership.displayName ?? "Ohne Namen"}</TableCell>
                  <TableCell>{membership.email}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGES[membership.role]}>{ROLE_LABELS[membership.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGES[membership.status]}>{membership.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(membership.joinedAt ?? membership.createdAt).toLocaleDateString("de-DE")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
