import type { FoodDatabaseUpdate } from "@/lib/types";

export const FOOD_DATABASE_UPDATES: FoodDatabaseUpdate[] = [
  {
    id: "update_bls_302",
    sourceId: "bls",
    version: "3.02",
    releaseDate: "2026-02-01",
    notes: "Neue Vollkornprodukte und aktualisierte Fettsäureprofile.",
    highlights: [
      "+420 neue Lebensmittel mit vollständigem Aminosäureprofil",
      "Verbesserte Zuckerarten-Differenzierung",
      "Deklaration pflanzlicher Omega-3-Quellen",
    ],
  },
  {
    id: "update_sfk_q4",
    sourceId: "sfk",
    version: "2025 Q4",
    releaseDate: "2025-12-15",
    notes: "Neue Vitaminoide und aktualisierte Referenzwerte.",
    highlights: [
      "Erweiterung um Vitamin K2-Unterformen",
      "Präzisere Mineralstoffdaten für Nüsse",
      "Kochsalzverluste je Zubereitungsart",
    ],
  },
  {
    id: "update_usda_jan",
    sourceId: "usda",
    version: "2026-01",
    releaseDate: "2026-01-05",
    notes: "Direktabgleich mit FoodData Central SR-Legacy.",
    highlights: [
      "Neue pflanzenbasierte Ersatzprodukte",
      "CO₂-Fußabdruckfelder",
      "200 zusätzliche klinische Getränke",
    ],
  },
  {
    id: "update_afcd_sep",
    sourceId: "afcd",
    version: "2025-09",
    releaseDate: "2025-09-30",
    notes: "Integration traditioneller chinesischer Rezepte.",
    highlights: [
      "Authentische Haushaltsmaße",
      "Trocken-/Frischwerte verknüpft",
      "Laktosefreie Sojaprodukte",
    ],
  },
  {
    id: "update_hersteller_mar",
    sourceId: "hersteller",
    version: "2026-03",
    releaseDate: "2026-03-10",
    notes: "Chargenbasierte Updates der Industriepartner.",
    highlights: [
      "Additiv-Scanner für LMIV",
      "Neue Allergentabellen",
      "Klimabilanzen pro Charge",
    ],
  },
];
