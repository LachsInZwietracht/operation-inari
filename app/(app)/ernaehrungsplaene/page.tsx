import Link from "next/link";
import { ArrowLeftRight, ArrowRight, BookMarked, CalendarDays, Sigma } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PLAN_HEADER = {
  title: "Ernährungspläne",
  description: "Pläne erstellen, aus Vorlagen starten und Varianten vergleichen.",
  helpText:
    "Hier laufen alle Ernährungsplan-Workflows zusammen: Erstellen Sie einen neuen Plan, starten Sie aus einer gespeicherten Vorlage oder vergleichen Sie mehrere Pläne nebeneinander.",
};

interface PlanTile {
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  route: string;
}

const PLAN_TILES: PlanTile[] = [
  {
    label: "Ernährungsplan erstellen",
    description: "Einen neuen Tages- oder Wochenplan zusammenstellen und analysieren.",
    icon: CalendarDays,
    route: "/ernaehrungsplan",
  },
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

export default function ErnaehrungsplaenePage() {
  return (
    <div className="space-y-6">
      <PageHeader {...PLAN_HEADER} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_TILES.map((tile) => (
          <Link
            key={tile.route}
            href={tile.route}
            prefetch={false}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/40">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg">
                  <tile.icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  {tile.label}
                  <ArrowRight
                    className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </CardTitle>
                <CardDescription>{tile.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
