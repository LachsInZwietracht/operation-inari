import type { ReportTemplate } from "@/lib/types"

const ts = (date: string) => ({ createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` })

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "report_template_short",
    name: "Kurzbericht Standard",
    category: "Kurz",
    content: `Zusammenfassung:
- Energieabdeckung {{energyCoverage}}
- Fokus: {{focus}}
Empfehlungen:
1. {{recommendation1}}
2. {{recommendation2}}`,
    ...ts("2026-01-02"),
  },
  {
    id: "report_template_follow",
    name: "Follow-up Coaching",
    category: "Verlauf",
    content: `Sehr geehrte/r {{patientName}},

wir haben Ihre letzten {{trackingDays}} Tage ausgewertet. Die Ballaststoffzufuhr beträgt {{fiber}} g und liegt damit {{fiberAssessment}}. Bitte behalten Sie die Mahlzeitenstruktur bei und ergänzen Sie {{actionItem}}.`,
    ...ts("2026-01-10"),
  },
  {
    id: "report_template_institution",
    name: "Institution – Wochenreport",
    category: "Institution",
    content: `Report Zeitraum: {{planDate}}
Diet line: {{dietLine}}
CO₂ pro Tag: {{co2}} kg
Health-Claim Ziel: {{claimTarget}}

Nächste Schritte:
- {{nextStep1}}
- {{nextStep2}}`,
    ...ts("2026-01-12"),
  },
]
