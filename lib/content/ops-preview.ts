import type {
  ApiEndpointDescription,
  ComplianceChecklistItem,
  EncryptionLayer,
  RecoveryObjective,
  RoleDefinition,
  SecurityControl,
} from "@/lib/types";

export const API_ENDPOINT_PREVIEWS: ApiEndpointDescription[] = [
  {
    id: "foods",
    route: "/api/v1/foods",
    method: "GET",
    description: "Geplanter Listenendpunkt fuer katalogisierte Lebensmittel inklusive Filterparametern.",
    sampleResponse: {
      items: [{ id: "food_karotte", name: "Karotte", source: "bls" }],
      nextCursor: "cursor_2",
    },
  },
  {
    id: "recipes",
    route: "/api/v1/recipes",
    method: "GET",
    description: "Geplanter Endpunkt fuer Rezeptbibliothek und Metadaten.",
    sampleResponse: {
      items: [{ id: "recipe_123", name: "Mediterrane Bowl", servings: 2 }],
      total: 128,
    },
  },
];

export const INTEGRATION_PREVIEWS = [
  {
    id: "fhir",
    label: "EHR/FHIR Schnittstelle",
    description: "Praxis- und Kliniksysteme ueber standardisierte Ressourcen anbinden.",
    status: "Preview",
  },
  {
    id: "debinet",
    label: "DEBInet Import",
    description: "Importvorlagen fuer Ernährungsprotokolle und institutionelle Kostformen.",
    status: "Preview",
  },
  {
    id: "warehouse",
    label: "BI / Data Warehouse",
    description: "Geplante Event-Exporte fuer Controlling, Data Lake und Reporting.",
    status: "Preview",
  },
] as const;

export const WEBHOOK_EVENT_PREVIEWS = [
  {
    id: "patient.created",
    event: "patient.created",
    description: "Patient wurde angelegt oder aus einer Demo-Quelle uebernommen.",
    delivery: "Noch nicht abonnierbar",
  },
  {
    id: "protocol.submitted",
    event: "protocol.submitted",
    description: "Digitales Protokoll wurde ueber den oeffentlichen Link eingereicht.",
    delivery: "Queue wird persistiert",
  },
  {
    id: "export.completed",
    event: "export.completed",
    description: "Exportdatei wurde erzeugt und im Audit-Journal erfasst.",
    delivery: "Queue wird persistiert",
  },
] as const;

export const ADMIN_ROLE_MATRIX: RoleDefinition[] = [
  {
    id: "admin",
    label: "Administrator/in",
    description: "Gesamtsystem verwalten, Organisationsregeln und kritische Freigaben steuern.",
    permissions: [
      { module: "Patientenakten", access: "vollzugriff", critical: true },
      { module: "Lebensmittel & Rezepte", access: "vollzugriff" },
      { module: "Praxisorganisation", access: "vollzugriff" },
      { module: "Institutionelle Module", access: "vollzugriff" },
      { module: "Abrechnung & Finanzen", access: "vollzugriff", critical: true },
      { module: "Systemeinstellungen", access: "vollzugriff", critical: true },
    ],
  },
  {
    id: "ernaehrungsberater",
    label: "Ernaehrungsfachkraft",
    description: "Patienten betreuen, Plaene erstellen und dokumentieren.",
    permissions: [
      { module: "Patientenakten", access: "vollzugriff", critical: true },
      { module: "Lebensmittel & Rezepte", access: "vollzugriff" },
      { module: "Praxisorganisation", access: "bearbeiten" },
      { module: "Institutionelle Module", access: "bearbeiten" },
      { module: "Abrechnung & Finanzen", access: "einsicht" },
      { module: "Systemeinstellungen", access: "gesperrt" },
    ],
  },
  {
    id: "assistent",
    label: "Assistenz",
    description: "Termine koordinieren und Vorlagen vorbereiten.",
    permissions: [
      { module: "Patientenakten", access: "einsicht" },
      { module: "Lebensmittel & Rezepte", access: "bearbeiten" },
      { module: "Praxisorganisation", access: "vollzugriff" },
      { module: "Institutionelle Module", access: "einsicht" },
      { module: "Abrechnung & Finanzen", access: "bearbeiten" },
      { module: "Systemeinstellungen", access: "gesperrt" },
    ],
  },
];

export const ADMIN_SECURITY_CONTROLS: SecurityControl[] = [
  {
    id: "mfa",
    label: "Zwei-Faktor-Pflicht",
    description: "Fuer produktive Teamverwaltung als Standard vorgesehen.",
    enabled: true,
    impact: "hoch",
  },
  {
    id: "sso",
    label: "SSO via Azure AD / Entra",
    description: "Zielbild fuer Klinik- und Praxisrollouts mit zentralem Identitaetsmanagement.",
    enabled: false,
    impact: "mittel",
  },
  {
    id: "device-trust",
    label: "Geraete-Trust",
    description: "Neue Endgeraete sollen kuenftig explizit freigegeben werden.",
    enabled: true,
    impact: "mittel",
  },
  {
    id: "session-timeout",
    label: "Sitzungstimeout 15 min",
    description: "Vorgesehene Richtlinie fuer sensible Arbeitsplaetze.",
    enabled: true,
    impact: "niedrig",
  },
];

export const ADMIN_ENCRYPTION_LAYERS: EncryptionLayer[] = [
  {
    id: "at-rest",
    layer: "Datenbankruhe (AES-256)",
    status: "aktiv",
    detail: "Supabase Storage und Postgres liegen verschluesselt in der Plattform.",
  },
  {
    id: "in-transit",
    layer: "Transport (TLS 1.3)",
    status: "aktiv",
    detail: "Alle Browser- und API-Verbindungen laufen verschluesselt ueber HTTPS/TLS.",
  },
  {
    id: "field-level",
    layer: "Feldverschluesselung",
    status: "wartung",
    detail: "Noch kein separates produktives Schluesselmanagement fuer einzelne Klinikfelder.",
  },
];

export const ADMIN_COMPLIANCE_CHECKLIST: ComplianceChecklistItem[] = [
  {
    id: "dsgvo",
    label: "Verarbeitungsverzeichnis und AVV pruefen",
    owner: "Produkt / Ops",
    status: "in arbeit",
  },
  {
    id: "backup-drill",
    label: "Restore-Test fuer produktive Umgebung dokumentieren",
    owner: "Engineering",
    status: "offen",
  },
  {
    id: "access-review",
    label: "Rollenmodell mit Klinik/Praxis abstimmen",
    owner: "Founders",
    status: "offen",
  },
];

export const ADMIN_RECOVERY_OBJECTIVES: RecoveryObjective[] = [
  {
    id: "rpo",
    metric: "RPO Ziel",
    value: "< 24h",
    target: "< 24h",
    status: "gelb",
  },
  {
    id: "rto",
    metric: "RTO Ziel",
    value: "< 4h",
    target: "< 4h",
    status: "gelb",
  },
  {
    id: "audit",
    metric: "Auditierbarkeit",
    value: "Teilweise",
    target: "Vollstaendig",
    status: "gelb",
  },
];
