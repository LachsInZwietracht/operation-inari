import type {
  AssessmentMethod,
  MealSlotType,
  ProtocolType,
} from "@/lib/types"
import { HOUSEHOLD_PRESETS } from "@/lib/constants"

export interface ProtocolTemplateStep {
  title: string
  description: string
  hints?: string[]
}

export interface ProtocolTemplateSection {
  title: string
  checklist: string[]
  emphasis?: string
}

export interface ProtocolTemplate {
  id: string
  title: string
  description: string
  defaultType: ProtocolType
  method: AssessmentMethod
  recommendedDays: number
  defaultNotes?: string
  tags: string[]
  steps: ProtocolTemplateStep[]
  sections?: ProtocolTemplateSection[]
  measurementPreset?: "household"
  quickAddPresetIds?: string[]
  suggestedMealSlots?: MealSlotType[]
}

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: "24h_recall",
    title: "24h Recall",
    description:
      "Telefonisches Recall mit Fokus auf den Vortag. Ideal für Erstkontakt und schnelle Gap-Analyse.",
    defaultType: "24h_recall",
    method: "24h_recall",
    recommendedDays: 1,
    tags: ["Standard", "Schnell", "Telefon"],
    defaultNotes:
      "Durchgeführt als geführtes Interview. Fokus auf Getränke & spontane Snacks hervorheben.",
    steps: [
      {
        title: "Frühstück & Morgenritual",
        description: "Weckzeit, erster Kaffee/Tee, Brotaufstriche, Supplements",
        hints: ["Uhrzeit & Menge erfassen", "Zubereitungsarten notieren"],
      },
      {
        title: "Mittag + Snacks",
        description: "Warme Mahlzeit, Zwischenmahlzeiten, Auswärtsessen",
        hints: ["Beilagen einzeln erfassen", "Saucen & Fette nicht vergessen"],
      },
      {
        title: "Abend & Spät",
        description: "Kalte Mahlzeit, TV-Snacks, Alkohol",
        hints: ["Alkohol separat erfassen", "Zeitpunkt festhalten"],
      },
    ],
  },
  {
    id: "ffq_standard",
    title: "Food Frequency Questionnaire",
    description:
      "Quantitative FFQ mit vier Lebensmittelblöcken. Dient zur langfristigen Ernährungsanalyse.",
    defaultType: "food_frequency",
    method: "ffq",
    recommendedDays: 7,
    tags: ["Strukturiert", "Langfristig"],
    steps: [
      {
        title: "Getreide & Stärke",
        description: "Brot, Reis, Nudeln, Frühstücksflocken",
        hints: ["Häufigkeit / Woche festhalten", "Portionsgrößen nach Schema notieren"],
      },
      {
        title: "Obst & Gemüse",
        description: "Frisch, gefroren, Säfte",
        hints: ["Smoothies zählen", "Verstecktes Gemüse angeben"],
      },
      {
        title: "Milch + Alternativen",
        description: "Milch, Käse, Pflanzenmilch, Joghurt",
        hints: ["Fettstufe ergänzen", "Anreicherung (Ca/B12) markieren"],
      },
      {
        title: "Fertigprodukte & Getränke",
        description: "Softdrinks, Energy, Süßigkeiten, Convenience",
      },
    ],
    sections: [
      {
        title: "Häufigkeitsskala",
        checklist: [
          "3×/Tag",
          "1×/Tag",
          "2–4×/Woche",
          "1×/Woche",
          "Seltener",
        ],
        emphasis: "Frequenz immer notieren, auch wenn Menge unklar",
      },
    ],
  },
  {
    id: "diary_week",
    title: "Mehr-Tages-Tagebuch",
    description: "3–7 Tage inkl. Wochenende. Ideal zur Energie- und Makroanalyse.",
    defaultType: "ernaehrungsprotokoll",
    method: "diet_diary",
    recommendedDays: 4,
    tags: ["Fotooption", "Wochenende"],
    steps: [
      {
        title: "Setup",
        description: "Tagebuch oder App einrichten, Portionstabellen ausgeben",
      },
      {
        title: "Werktage erfassen",
        description: "Zwei typische Bürotage dokumentieren",
      },
      {
        title: "Wochenende erfassen",
        description: "Mindestens ein Tag mit Freizeitstruktur",
      },
      {
        title: "Kommentar & Stimmung",
        description: "Hungergefühl, Stressfaktoren notieren",
      },
    ],
  },
  {
    id: "household_guided",
    title: "Haushaltsmengen",
    description:
      "Vereinfachte Mengen mit Haushaltsmaßen – perfekt für Klient:innen ohne Küchenwaage.",
    defaultType: "household",
    method: "household",
    recommendedDays: 3,
    measurementPreset: "household",
    tags: ["Niedrige Hürden", "Alltag", "Analog"],
    defaultNotes:
      "Klient:in verwendet Haushaltsmaße. Grammatiken automatisch geschätzt.",
    steps: [
      {
        title: "Messhilfen erklären",
        description: "Tasse, Glas, Löffel zeigen und fotografieren",
      },
      {
        title: "Standardportionen hinterlegen",
        description: "Lieblingsgerichte und Mengen skizzieren",
      },
      {
        title: "Kontrollanruf",
        description: "Kurzcheck nach Tag 1 zur Plausibilisierung",
      },
    ],
    sections: [
      {
        title: "Dokumentations-Tipps",
        checklist: [
          "Jede Portion mit Uhrzeit",
          "Zusatzstoffe (Butter, Zucker) separat",
          "Getränke immer als Glas/Tasse",
        ],
      },
    ],
    quickAddPresetIds: HOUSEHOLD_PRESETS.map((preset) => preset.id),
  },
  {
    id: "freiburg",
    title: "Freiburger Ernährungsprotokoll",
    description:
      "DIN-A4 Layout mit fester Reihenfolge. Ideal für printbare Erfassung & Archivierung.",
    defaultType: "ernaehrungsprotokoll",
    method: "freiburg",
    recommendedDays: 3,
    tags: ["DIN A4", "Print", "Strukturiert"],
    defaultNotes:
      "Reihenfolge gemäß VDOE Vorlage (Getränke → Brot → Aufstriche etc.).",
    steps: [
      {
        title: "Spalte Getränke",
        description: "Wasser, Kaffee, Tee, Alkohol pro Mahlzeit",
      },
      {
        title: "Brot & Aufstriche",
        description: "Brote, Brötchen, Fett- und Proteinbeläge",
      },
      {
        title: "Mittagsgericht",
        description: "Komponenten einzeln, inkl. Sauce",
      },
      {
        title: "Abend & Sonstiges",
        description: "Knabbereien, Süßes, Supplemente",
      },
    ],
    sections: [
      {
        title: "Reihenfolge laut Formular",
        checklist: [
          "Getränke",
          "Brot/Backwaren",
          "Aufstriche/Beläge",
          "Milchprodukte",
          "Mittagessen",
          "Abendessen",
          "Snacks/Sonstiges",
        ],
        emphasis: "Immer links nach rechts ausfüllen – erleichtert spätere Kontrolle",
      },
    ],
  },
  {
    id: "vegetarian",
    title: "Vegetarisches Template",
    description: "Leitet gezielt durch pflanzliche Protein- & Calciumquellen.",
    defaultType: "ernaehrungsprotokoll",
    method: "vegetarian",
    recommendedDays: 4,
    tags: ["Plant-forward", "Protein", "Calcium"],
    steps: [
      {
        title: "Protein-Bausteine",
        description: "Eier, Hülsenfrüchte, Milchprodukte erfassen",
      },
      {
        title: "B12 & Supplemente",
        description: "Notieren ob Supplementierung existiert",
      },
      {
        title: "Kalziumquellen",
        description: "Mandeldrinks, grünes Gemüse, Mineralwasser",
      },
    ],
    sections: [
      {
        title: "Checkliste",
        checklist: [
          "Mind. 2 Hülsenfrucht-Portionen",
          "Milch/Alternative mit Ca",
          "Eiweiß über Tag verteilt",
        ],
      },
    ],
    suggestedMealSlots: [
      "fruehstueck",
      "snack_vormittag",
      "mittagessen",
      "snack_nachmittag",
      "abendessen",
    ],
  },
  {
    id: "vegan",
    title: "Veganes Template",
    description: "Guided Flow für vegane Klient:innen mit Fokus auf kritische Nährstoffe.",
    defaultType: "ernaehrungsprotokoll",
    method: "vegan",
    recommendedDays: 5,
    tags: ["Vegan", "B12", "Protein"],
    steps: [
      {
        title: "Proteinmix",
        description: "Tofu, Tempeh, Seitan, Hülsenfrüchte",
      },
      {
        title: "Supplemente",
        description: "B12, D3/K2, Omega-3 erfassen",
      },
      {
        title: "Angereicherte Produkte",
        description: "Fortifizierte Drinks, Cerealien",
      },
      {
        title: "Snackqualität",
        description: "Süßes, Smoothies, Convenience",
      },
    ],
    sections: [
      {
        title: "Nährstoff-Fokus",
        checklist: ["B12", "Calcium", "Eisen", "Omega-3"],
        emphasis: "Kennzeichnet potenzielle Engpässe direkt bei der Erfassung",
      },
    ],
    suggestedMealSlots: [
      "fruehstueck",
      "snack_vormittag",
      "mittagessen",
      "snack_nachmittag",
      "abendessen",
    ],
  },
]
