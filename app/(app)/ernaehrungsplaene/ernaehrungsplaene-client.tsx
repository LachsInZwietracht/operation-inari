"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BookMarked,
  CalendarDays,
  Search,
  Sigma,
  UtensilsCrossed,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { DIET_LINES } from "@/lib/reference-data/diet-lines";
import { cn } from "@/lib/utils";
import type { DailyMealPlan, Patient } from "@/lib/types";

const PLAN_HEADER = {
  title: "Ernährungspläne",
  description: "Alle Pläne der Praxis, nach Patient sortiert.",
  helpText:
    "Ein Ernährungsplan gehört immer zu einem Patienten. Diese Seite listet, was Sie gebaut haben; bearbeitet wird ein Plan in der Patientenakte unter „Ernährungsplan“.",
};

const STATUS_META: Record<NonNullable<DailyMealPlan["status"]>, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  approved: "Freigegeben",
  archived: "Archiviert",
};

interface PlanTile {
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  route: string;
}

/**
 * The tools that are not tied to one patient. They used to be the whole page;
 * now they are a footer to it, because "which plans exist" is the question this
 * route is opened with.
 */
const PLAN_TOOLS: PlanTile[] = [
  {
    label: "Planvorlagen",
    description: "Aus gespeicherten Vorlagen starten und wiederverwenden.",
    icon: BookMarked,
    route: "/ernaehrungsplan/bibliothek",
  },
  {
    label: "Pläne vergleichen",
    description: "Mehrere Pläne nebeneinander stellen und Nährwerte gegenüberstellen.",
    icon: Sigma,
    route: "/ernaehrungsplan/vergleich",
  },
  {
    label: "Austauschtabellen",
    description: "Geeignete Lebensmittel-Alternativen mit Austauschmengen finden.",
    icon: ArrowLeftRight,
    route: "/austauschtabellen",
  },
];

function planHref(patientId: string) {
  return `/patienten/${patientId}?tab=ernaehrungsplan`;
}

function planTitle(plan: DailyMealPlan) {
  return plan.title?.trim() || `Plan vom ${formatDate(plan.date)}`;
}

function dietLineName(dietLineId?: string) {
  if (!dietLineId) return null;
  return DIET_LINES.find((line) => line.id === dietLineId)?.name ?? dietLineId;
}

function countEntries(plan: DailyMealPlan) {
  return plan.slots.reduce((total, slot) => total + slot.entries.length, 0);
}

interface ErnaehrungsplaenePageClientProps {
  initialPatients: Patient[];
  initialPlans: DailyMealPlan[];
}

export function ErnaehrungsplaenePageClient({
  initialPatients,
  initialPlans,
}: ErnaehrungsplaenePageClientProps) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const groups = useMemo(() => {
    const byPatient = new Map<string, { patient: Patient; plans: DailyMealPlan[] }>();
    for (const patient of initialPatients) {
      byPatient.set(patient.id, { patient, plans: [] });
      if (patient.legacyId) byPatient.set(patient.legacyId, byPatient.get(patient.id)!);
    }

    for (const plan of initialPlans) {
      if (!plan.patientId) continue;
      byPatient.get(plan.patientId)?.plans.push(plan);
    }

    // The map holds legacy ids as extra keys pointing at the same group, so
    // dedupe on the group object before sorting.
    const unique = Array.from(new Set(byPatient.values()));
    for (const group of unique) {
      group.plans.sort((left, right) => right.date.localeCompare(left.date));
    }

    const needle = query.trim().toLowerCase();
    return unique
      .filter((group) => {
        const plans = showArchived
          ? group.plans
          : group.plans.filter((plan) => plan.status !== "archived");
        if (plans.length === 0) return false;
        if (!needle) return true;
        const name = `${group.patient.lastName} ${group.patient.firstName}`.toLowerCase();
        return name.includes(needle) || plans.some((plan) => planTitle(plan).toLowerCase().includes(needle));
      })
      .map((group) => ({
        ...group,
        plans: showArchived
          ? group.plans
          : group.plans.filter((plan) => plan.status !== "archived"),
      }))
      .sort((left, right) =>
        `${left.patient.lastName}${left.patient.firstName}`.localeCompare(
          `${right.patient.lastName}${right.patient.firstName}`,
          "de",
        ),
      );
  }, [initialPatients, initialPlans, query, showArchived]);

  const totalPlans = groups.reduce((total, group) => total + group.plans.length, 0);
  const archivedCount = initialPlans.filter((plan) => plan.status === "archived").length;

  return (
    <div className="space-y-6">
      <PageHeader {...PLAN_HEADER}>
        <Button asChild variant="outline">
          <Link href="/patienten">
            Zu den Patienten
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Patient oder Plan suchen …"
            className="pl-9"
            aria-label="Pläne durchsuchen"
          />
        </div>
        {archivedCount > 0 && (
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived((previous) => !previous)}
          >
            Archivierte {showArchived ? "ausblenden" : `zeigen (${archivedCount})`}
          </Button>
        )}
        <p className="text-muted-foreground text-sm">
          {totalPlans} {totalPlans === 1 ? "Plan" : "Pläne"} bei {groups.length}{" "}
          {groups.length === 1 ? "Patient" : "Patienten"}
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted rounded-full p-3">
              <UtensilsCrossed className="text-muted-foreground size-5" />
            </div>
            <div>
              <p className="font-medium">
                {query ? "Kein Treffer" : "Noch kein Ernährungsplan angelegt"}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                {query
                  ? "Für diese Suche gibt es keinen Plan."
                  : "Pläne entstehen in der Patientenakte. Öffnen Sie einen Patienten und wechseln Sie dort auf „Ernährungsplan“."}
              </p>
            </div>
            {!query && (
              <Button asChild>
                <Link href="/patienten">Patient auswählen</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(({ patient, plans }) => (
            <Card key={patient.id} className="overflow-hidden py-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={planHref(patient.id)}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {patient.lastName}, {patient.firstName}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {plans.length} {plans.length === 1 ? "Plan" : "Pläne"}
                    {patient.indications?.length ? ` · ${patient.indications.join(" · ")}` : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={planHref(patient.id)}>
                    Planer öffnen
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
              <ul className="divide-y">
                {plans.map((plan) => {
                  const line = dietLineName(plan.dietLineId);
                  return (
                    <li key={plan.id}>
                      <Link
                        href={planHref(patient.id)}
                        className="hover:bg-muted/40 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors"
                      >
                        <CalendarDays className="text-muted-foreground size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {planTitle(plan)}
                        </span>
                        {line && (
                          <Badge variant="secondary" className="font-normal">
                            {line}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(plan.status === "archived" && "text-muted-foreground")}
                        >
                          {plan.replacedAt ? "Ersetzt" : STATUS_META[plan.status ?? "draft"]}
                        </Badge>
                        <span className="text-muted-foreground w-24 shrink-0 text-right text-xs tabular-nums">
                          {countEntries(plan)} {countEntries(plan) === 1 ? "Eintrag" : "Einträge"}
                        </span>
                        <span className="text-muted-foreground w-24 shrink-0 text-right text-xs tabular-nums">
                          {formatDate(plan.date)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {PLAN_TOOLS.map((tile) => (
          <Link
            key={tile.route}
            href={tile.route}
            className="group rounded-xl focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Card className="group-hover:border-primary/50 group-hover:bg-accent/40 h-full transition-colors">
              <CardContent className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <tile.icon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tile.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{tile.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
