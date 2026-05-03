import { Suspense } from "react";

import { fetchMenuPlans } from "@/lib/data/menu-plans";
import { fetchRecipes } from "@/lib/data/recipes";
import { KrankenhausPageClient } from "./krankenhaus-client";
import { PageHeader } from "@/components/page-header";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient } from "@/lib/supabase/server";

const HOSPITAL_HEADER = {
  title: "Krankenhausverwaltung",
  description: "Inpatient-Zuordnung, sichere Essensauswahl und Stationsausgabe",
  helpText:
    "Pflege oder Ernährungsberatung ordnet Patienten Betten zu, wählt sichere Menüoptionen je Servicefenster aus und erstellt Küchen- sowie Tablettenausgaben.",
};

async function HospitalContent() {
  const supabase = await createClient();
  const auditLog = writeAccessAuditLog(supabase, {
    action: "institution_workspace_accessed",
    targetType: "institution_workspace",
    targetId: "krankenhaus",
    metadata: { route: "/institution/krankenhaus" },
  });
  const [recipes, menus] = await Promise.all([
    fetchRecipes(),
    fetchMenuPlans(),
  ]);
  await auditLog;

  return <KrankenhausPageClient recipes={recipes} initialMenus={menus} />;
}

function HospitalSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader {...HOSPITAL_HEADER} />
      <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
      <div className="h-72 rounded-xl border bg-muted animate-pulse" />
    </div>
  );
}

export default function KrankenhausPage() {
  return (
    <Suspense fallback={<HospitalSkeleton />}>
      <HospitalContent />
    </Suspense>
  );
}
