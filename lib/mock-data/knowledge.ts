import type { KnowledgeCard, SustainabilityMetric } from "@/lib/types";

export const KNOWLEDGE_CARDS: KnowledgeCard[] = [
  {
    id: "lexicon_macro",
    category: "Lexikon",
    title: "Makronährstoffe kompakt",
    summary: "Zusammenfassung der Hauptnährstoffe mit Berechnungshilfen.",
    tags: ["Grundlagen", "Makro"],
  },
  {
    id: "herbs_digestiv",
    category: "Kräuter",
    title: "Verdauungsfördernde Kräuter",
    summary: "Fenchel, Kümmel und Anis für Haushaltsmengen.",
    tags: ["Phytotherapie", "Haushaltsmengen"],
  },
  {
    id: "patient_handout",
    category: "Handouts",
    title: "Patientenleitfaden Diabetes",
    summary: "10-Seiten-PDF mit Austauschlisten und Mahlzeitenplan.",
    tags: ["Download", "Diabetes"],
  },
  {
    id: "ai_assistant",
    category: "AI-Hinweise",
    title: "Prompts für Mahlzeiten-Ideen",
    summary: "Vorlagen zur Abfrage des integrierten Assistenten.",
    tags: ["AI", "Produktivität"],
  },
];

export const SUSTAINABILITY_METRICS: SustainabilityMetric[] = [
  { id: "co2_foods", label: "Ø CO₂ pro Lebensmittel", value: 1.9, unit: "kg", change: -8 },
  { id: "co2_recipes", label: "Rezepte unter 2 kg CO₂", value: 68, unit: "%", change: 5 },
  { id: "co2_menu", label: "Menüplan Fußabdruck", value: 12.4, unit: "kg/Tag", change: -12 },
  { id: "diversity", label: "Lebensmittelvielfalt", value: 22, unit: "Gruppen", change: 4 },
];
