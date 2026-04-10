import type { FoodSourceDefinition } from "@/lib/types";

export const FOOD_SOURCES: FoodSourceDefinition[] = [
  {
    id: "bls",
    name: "BLS (Bundeslebensmittelschlüssel)",
    version: "3.02",
    updatedAt: "2026-02-01",
    description: "Offizielle deutsche Referenzdatenbank mit Fokus auf Grundnahrungsmittel.",
    coverage: "14.200 Lebensmittel / 280 Nährstoffe",
  },
  {
    id: "sfk",
    name: "Souci-Fachmann-Kraut",
    version: "2025 Q4",
    updatedAt: "2025-12-15",
    description: "Detailliertes Nachschlagewerk mit Fokus auf Mikronährstoffe.",
    coverage: "1.800 Lebensmittel / 320 Nährstoffe",
  },
  {
    id: "usda",
    name: "USDA FoodData Central",
    version: "2026-01",
    updatedAt: "2026-01-05",
    description: "Internationale Datenbank der US-Landwirtschaftsbehörde.",
    coverage: "370.000 Lebensmittel / 360 Nährstoffe",
  },
  {
    id: "afcd",
    name: "AFCD Asia Food Composition",
    version: "2025-09",
    updatedAt: "2025-09-30",
    description: "Asiatische Quellen zur Abdeckung multikultureller Ernährungsweisen.",
    coverage: "5.200 Lebensmittel / 210 Nährstoffe",
  },
  {
    id: "hersteller",
    name: "Herstellerdaten",
    version: "2026-03",
    updatedAt: "2026-03-10",
    description: "Direktmeldungen von Lebensmittelherstellern inkl. Allergenen & Zusatzstoffen.",
    coverage: "32.500 Produkte / LMIV vollständig",
  },
  {
    id: "custom",
    name: "Eigene Lebensmittel",
    version: "LIVE",
    updatedAt: new Date().toISOString().slice(0, 10),
    description: "Individuelle Eingaben, importierte Rezepte und Patientenprodukte.",
    coverage: "Praxis-spezifisch",
  },
];
