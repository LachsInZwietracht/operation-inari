"use client";

import { PageHeader } from "@/components/page-header";
import { RecipeForm } from "@/components/recipe-form";

export default function NeuesRezeptPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Neues Rezept erstellen"
        description="Erstellen Sie ein neues Rezept mit Zutaten und Zubereitung"
      />
      <RecipeForm />
    </div>
  );
}
