import type { KnowledgeCard } from "@/lib/types";

export const KNOWLEDGE_LIBRARY_DEFAULTS: KnowledgeCard[] = [
  {
    id: "macro-basics",
    category: "Lexikon",
    title: "Makronaehrstoffe kompakt",
    summary: "Kurzreferenz zu Protein, Fett, Kohlenhydraten und den wichtigsten Beratungsfragen.",
    tags: ["Bundled", "Grundlagen"],
  },
  {
    id: "allergen-briefing",
    category: "SOP",
    title: "Allergenwarnungen im Planungsworkflow",
    summary: "Empfohlene Pruefpunkte fuer Lebensmittel-, Rezept- und Menueplanfreigaben.",
    tags: ["Bundled", "Allergene"],
  },
  {
    id: "digital-protocol",
    category: "Workflow",
    title: "Digitale Protokolle sauber uebernehmen",
    summary: "Hinweise fuer Review, Konvertierung und Nachbearbeitung patientenseitiger Eintraege.",
    tags: ["Bundled", "Protokolle"],
  },
  {
    id: "report-handover",
    category: "Handouts",
    title: "Berichtsexporte fuer Verlaufsgespraeche",
    summary: "Empfohlene Struktur fuer Kurzberichte, CSV-Anhaenge und patientengebundene Versionen.",
    tags: ["Bundled", "Berichte"],
  },
];
