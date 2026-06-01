import type { AgeGroup, ReferenceStandardId } from "@/lib/types";

export const AGE_GROUPS: AgeGroup[] = [
  { id: "0-4m", label: "0–4 Monate", minAge: 0, maxAge: 0.33 },
  { id: "4-12m", label: "4–12 Monate", minAge: 0.33, maxAge: 1 },
  { id: "1-4", label: "1–4 Jahre", minAge: 1, maxAge: 4 },
  { id: "4-7", label: "4–7 Jahre", minAge: 4, maxAge: 7 },
  { id: "7-10", label: "7–10 Jahre", minAge: 7, maxAge: 10 },
  { id: "10-13", label: "10–13 Jahre", minAge: 10, maxAge: 13 },
  { id: "13-15", label: "13–15 Jahre", minAge: 13, maxAge: 15 },
  { id: "15-19", label: "15–19 Jahre", minAge: 15, maxAge: 19 },
  { id: "19-25", label: "19–25 Jahre", minAge: 19, maxAge: 25 },
  { id: "25-51", label: "25–51 Jahre", minAge: 25, maxAge: 51 },
  { id: "51-65", label: "51–65 Jahre", minAge: 51, maxAge: 65 },
  { id: "65+", label: "65+ Jahre", minAge: 65, maxAge: Infinity },
];

export const REFERENCE_STANDARD_METADATA: Record<
  Exclude<ReferenceStandardId, "custom">,
  { name: string; shortName: string; description: string; country: string; edition: string }
> = {
  dge: {
    name: "Deutsche Gesellschaft für Ernährung",
    shortName: "DGE",
    description: "Offizielle Referenzwerte für Deutschland.",
    country: "DE",
    edition: "2024",
  },
  oege: {
    name: "Österreichische Gesellschaft für Ernährung",
    shortName: "ÖGE",
    description: "Referenzwerte für Österreich mit D-A-CH-Abstimmung.",
    country: "AT",
    edition: "2024",
  },
  sge: {
    name: "Schweizerische Gesellschaft für Ernährung",
    shortName: "SGE",
    description: "Referenzwerte für die Schweiz.",
    country: "CH",
    edition: "2024",
  },
  rda: {
    name: "Recommended Dietary Allowances",
    shortName: "RDA",
    description: "US-amerikanische Referenzwerte.",
    country: "US",
    edition: "2024",
  },
};

const ENABLED_REFERENCE_STANDARDS: Exclude<ReferenceStandardId, "custom">[] = [
  "dge",
  "oege",
  "sge",
  "rda",
];

export const REFERENCE_STANDARDS = (
  Object.entries(REFERENCE_STANDARD_METADATA) as [
    Exclude<ReferenceStandardId, "custom">,
    (typeof REFERENCE_STANDARD_METADATA)[Exclude<ReferenceStandardId, "custom">],
  ][]
)
  .filter(([id]) => ENABLED_REFERENCE_STANDARDS.includes(id))
  .map(([id, meta]) => ({ id, ...meta }));
