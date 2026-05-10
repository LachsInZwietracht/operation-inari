export interface ClinicDocumentPack {
  id: string
  name: string
  audience: string
  purpose: string
  sections: string[]
  template: string
}

export interface PatientHandoutTemplate {
  id: string
  name: string
  trigger: string
  tiedTo: "counseling" | "meal_plan" | "both"
  sections: string[]
  template: string
}

export const CLINIC_DOCUMENT_PACKS: ClinicDocumentPack[] = [
  {
    id: "nutrition-report",
    name: "Ernährungsbericht",
    audience: "Behandelndes Team",
    purpose: "Therapieziele, Nährstofflücken und Maßnahmen strukturiert zusammenfassen.",
    sections: ["Indikation", "Kurzfazit", "Nährstofflücken", "Therapieziele", "Kontrolltermin"],
    template:
      "Ernährungsbericht\nIndikation: {{focus}}\nKurzfazit: {{energyCoverage}} Energieabdeckung, CO2 {{co2}}.\nEmpfehlungen: {{recommendation1}}, {{recommendation2}}.\nNächster Schritt: {{nextStep1}}.",
  },
  {
    id: "physician-letter",
    name: "Arztbrief",
    audience: "Zuweiser und ärztlicher Dienst",
    purpose: "Beratungsstand, medizinische Relevanz und angeforderte Kontrollen weitergeben.",
    sections: ["Anlass", "Ernährungsdiagnose", "Intervention", "Laborkontrollen", "Rückfragen"],
    template:
      "Arztbrief Ernährungstherapie\nPatient: {{patientName}}\nAnlass: {{focus}}\nIntervention: {{actionItem}}.\nEmpfohlene Kontrolle: Labor und Gewichtsentwicklung im Verlauf.",
  },
  {
    id: "kitchen-handover",
    name: "Übergabe Küche",
    audience: "Küche, Service und Stationskoordination",
    purpose: "Kostform, Allergene und operative Hinweise ohne Therapieprosa bündeln.",
    sections: ["Kostform", "Allergene", "Textur", "Portion", "Sonderhinweise"],
    template:
      "Übergabe Küche\nPatient: {{patientName}}\nKostform: {{dietLine}}\nSonderhinweis: {{actionItem}}.\nBitte Allergen- und Zusatzstoffdeklaration vor Ausgabe prüfen.",
  },
  {
    id: "progress-note",
    name: "Verlaufsbericht",
    audience: "Ernährungstherapie und Pflege",
    purpose: "Verlauf seit letzter Beratung, Adhärenz und nächste Aufgaben dokumentieren.",
    sections: ["Verlauf", "Adhärenz", "Probleme", "Maßnahmen", "Follow-up"],
    template:
      "Verlaufsbericht\nSeit dem letzten Termin: {{trackingDays}} Protokolltage ausgewertet.\nFokus: {{focus}}.\nMaßnahme bis Folgetermin: {{actionItem}}.",
  },
  {
    id: "quality-report",
    name: "Qualitätsbericht",
    audience: "Leitung, QM und Einkauf",
    purpose: "Aggregierbare Kennzahlen für Therapiequalität, Nachhaltigkeit und Exportfähigkeit erfassen.",
    sections: ["Abdeckung", "Inari Score", "Health Claims", "CO2", "Offene Risiken"],
    template:
      "Qualitätsbericht\nPlan: {{planDate}}\nEnergieabdeckung: {{energyCoverage}}\nHealth-Claim-Ziele: {{claimTarget}}\nNächste operative Aufgabe: {{nextStep2}}.",
  },
]

export const PATIENT_HANDOUT_TEMPLATES: PatientHandoutTemplate[] = [
  {
    id: "fiber-practical",
    name: "Ballaststoffe im Alltag",
    trigger: "Ballaststoffziel unter Referenz oder Obst/Gemüsegruppen fehlen.",
    tiedTo: "meal_plan",
    sections: ["Ziel", "Lebensmitteltausch", "Portionsbeispiele", "3-Tage-Aufgabe"],
    template:
      "Patienten-Handout: Ballaststoffe\nZiel: {{fiber}} g Ballaststoffe pro Tag, aktuell {{fiberAssessment}}.\nAlltagsaufgabe: {{actionItem}} in zwei Mahlzeiten einbauen.",
  },
  {
    id: "protein-distribution",
    name: "Eiweiß über den Tag verteilen",
    trigger: "Proteinbedarf, Sarkopenie-Risiko oder postoperative Ernährung.",
    tiedTo: "both",
    sections: ["Tagesziel", "Mahlzeitenverteilung", "Geeignete Quellen", "Monitoring"],
    template:
      "Patienten-Handout: Eiweißverteilung\nZiel: Eiweiß gleichmäßig auf Hauptmahlzeiten verteilen.\nNächster Schritt: {{recommendation1}} und Verlauf im Protokoll prüfen.",
  },
  {
    id: "low-glycemic-meals",
    name: "Blutzuckerfreundliche Mahlzeiten",
    trigger: "Diabetes, Prädiabetes oder postprandiale Beschwerden.",
    tiedTo: "counseling",
    sections: ["Tellermodell", "Kohlenhydratqualität", "Protein/Fett-Kombination", "Selbstkontrolle"],
    template:
      "Patienten-Handout: Blutzuckerfreundliche Mahlzeiten\nFokus: Kohlenhydrate bewusst wählen und mit Protein/Fett kombinieren.\nBis zum nächsten Termin: {{trackingDays}} Tage dokumentieren.",
  },
]

export const REPORT_RETENTION_PREVIEW = {
  label: "Aufbewahrung: 10 Jahre, ueber Admin & Sicherheit konfigurierbar",
  controls: [
    "Standardfrist je Organisation",
    "Archivstatus pro patientengebundener Berichtsversion",
    "Admin-Freigabe vor Löschung",
    "Exportjournal mit Aufbewahrungsgrund",
  ],
}

export const SCHEDULED_EXPORT_REQUIREMENTS = [
  "Nur archivierte Berichtsversionen mit patientengebundener Snapshot-ID exportieren.",
  "Zeitpläne an Organisationsrollen und Audit-Logs binden.",
  "Retention-Frist und Löschsperre vor jedem geplanten Export prüfen.",
  "Fehler, Empfänger und Dateihash im Exportjournal protokollieren.",
]
