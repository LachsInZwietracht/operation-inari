import { Suspense } from "react";

import { fetchMenuPlans } from "@/lib/data/menu-plans";
import { fetchRecipes } from "@/lib/data/recipes";
import { KrankenhausPageClient } from "./krankenhaus-client";
import { PageHeader } from "@/components/page-header";

const HOSPITAL_HEADER = {
  title: "Krankenhausverwaltung",
  description: "Inpatient-Zuordnung, sichere Essensauswahl und Stationsausgabe",
  helpText:
    "Pflege oder Ernährungsberatung ordnet Patient:innen Betten zu, wählt sichere Menüoptionen je Servicefenster aus und erstellt Küchen- sowie Tablettenausgaben.",
};

async function HospitalContent() {
  const [recipes, menus] = await Promise.all([
    fetchRecipes(),
    fetchMenuPlans(),
  ]);

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
