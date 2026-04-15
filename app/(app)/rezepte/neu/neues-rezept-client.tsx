"use client";

import { PageHeader } from "@/components/page-header";
import { RecipeForm } from "@/components/recipe-form";

export function NeuesRezeptPageClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Neues Rezept erstellen"
        description="Erstellen Sie ein neues Rezept mit Zutaten und Zubereitung"
        helpText="Legen Sie ein neues Rezept an, fügen Sie Zutaten aus der Lebensmitteldatenbank hinzu und beschreiben Sie die Zubereitung. Die Nährwerte werden automatisch berechnet."
      />
      <RecipeForm />
    </div>
  );
}
