import Link from "next/link";
import { Apple, Plus, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FOOD_HEADER = {
  title: "Lebensmittel",
  description: "Lebensmittel durchsuchen und neue anlegen.",
  helpText:
    "Hier laufen alle Lebensmittel-Workflows zusammen: Durchsuchen Sie die gesamte Datenbank oder legen Sie ein eigenes Lebensmittel an.",
};

interface FoodTile {
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  route: string;
}

const FOOD_TILES: FoodTile[] = [
  {
    label: "Alle Lebensmittel",
    description: "Die gesamte Lebensmitteldatenbank durchsuchen und filtern.",
    icon: Apple,
    route: "/lebensmittel",
  },
  {
    label: "Neues Lebensmittel anlegen",
    description: "Ein eigenes Lebensmittel mit Nährwerten erfassen.",
    icon: Plus,
    route: "/lebensmittel/neu",
  },
];

export default function LebensmittelUebersichtPage() {
  return (
    <div className="space-y-6">
      <PageHeader {...FOOD_HEADER} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FOOD_TILES.map((tile) => (
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
