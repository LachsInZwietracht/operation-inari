"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FOOD_DATABASE_UPDATES, FOOD_SOURCES } from "@/lib/mock-data";
import { formatNumber } from "@/lib/format";

export default function DatenbankPage() {
  const [sourceFilter, setSourceFilter] = useState("all");

  const filteredUpdates = FOOD_DATABASE_UPDATES.filter((update) =>
    sourceFilter === "all" ? true : update.sourceId === sourceFilter,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datenbank-Updates"
        description="Versionshistorie, Release Notes und Quellenfilter"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full md:w-[260px]">
            <SelectValue placeholder="Quelle filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            {FOOD_SOURCES.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          <Filter className="mr-1 inline h-4 w-4" /> {filteredUpdates.length} Releases angezeigt
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredUpdates.map((update) => {
          const source = FOOD_SOURCES.find((s) => s.id === update.sourceId);
          return (
            <Card key={update.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  Version {update.version}
                  <Badge variant="secondary">{source?.name ?? update.sourceId}</Badge>
                </CardTitle>
                <CardDescription>{update.releaseDate}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{update.notes}</p>
                <ul className="list-inside list-disc text-sm">
                  {update.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quelle & Abdeckung</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {FOOD_SOURCES.map((source) => (
            <div key={source.id} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">{source.name}</p>
              <p className="text-xs text-muted-foreground">Version {source.version}</p>
              <p className="mt-2 text-muted-foreground">{source.coverage}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Angekündigte Releases</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {FOOD_SOURCES.slice(0, 3).map((source) => (
            <div key={source.id} className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-semibold">{source.name}</p>
              <p className="text-xs text-muted-foreground">Nächstes Update Q{formatNumber(Math.random() * 4 + 1, 0)} / {new Date().getFullYear()}</p>
              <p className="mt-1 text-muted-foreground">
                Fokus: Erweiterte Mikronährstoffe & CO₂-Daten
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
