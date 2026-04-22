import type {
  AdminUser,
  AuditLogEntry,
  BackupStatus,
  IntegrationToggle,
  ApiEndpointDescription,
  ApiKey,
  WebhookConfig,
  ExportJob,
  RoleDefinition,
  SecurityControl,
  EncryptionLayer,
  ComplianceChecklistItem,
  SessionMetric,
  RecoveryObjective,
} from "@/lib/types";

export const ADMIN_USERS: AdminUser[] = [
  {
    id: "user_admin",
    name: "Fabian Radlow",
    email: "fabian@inari.app",
    role: "Administrator",
    status: "aktiv",
    lastLogin: "2026-03-12T07:45:00Z",
  },
  {
    id: "user_nutri",
    name: "Sarah Dietrich",
    email: "sarah@inari.app",
    role: "Ernährungsfachkraft",
    status: "aktiv",
    lastLogin: "2026-03-11T15:20:00Z",
  },
  {
    id: "user_guest",
    name: "Max Mustermann",
    email: "max@inari.app",
    role: "Gast",
    status: "eingeladen",
    lastLogin: "–",
  },
];

export const ROLE_MATRIX: RoleDefinition[] = [
  {
    id: "admin",
    label: "Administrator/in",
    description: "Gesamtsystem verwalten, Mandanten-Einstellungen vornehmen",
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
    label: "Ernährungsfachkraft",
    description: "Patient:innen betreuen, Pläne erstellen und dokumentieren",
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
    description: "Termine koordinieren und Vorlagen vorbereiten",
    permissions: [
      { module: "Patientenakten", access: "einsicht" },
      { module: "Lebensmittel & Rezepte", access: "bearbeiten" },
      { module: "Praxisorganisation", access: "vollzugriff" },
      { module: "Institutionelle Module", access: "einsicht" },
      { module: "Abrechnung & Finanzen", access: "bearbeiten" },
      { module: "Systemeinstellungen", access: "gesperrt" },
    ],
  },
  {
    id: "gast",
    label: "Gast / Beobachter",
    description: "Leserechte für Schulungen und Audits",
    permissions: [
      { module: "Patientenakten", access: "einsicht" },
      { module: "Lebensmittel & Rezepte", access: "einsicht" },
      { module: "Praxisorganisation", access: "einsicht" },
      { module: "Institutionelle Module", access: "einsicht" },
      { module: "Abrechnung & Finanzen", access: "gesperrt", critical: true },
      { module: "Systemeinstellungen", access: "gesperrt" },
    ],
  },
];

export const AUDIT_LOG: AuditLogEntry[] = [
  {
    id: "log_1",
    timestamp: "2026-03-12T09:15:00Z",
    actor: "Sarah Dietrich",
    action: "hat Bericht exportiert",
    target: "Patient #2",
  },
  {
    id: "log_2",
    timestamp: "2026-03-11T17:35:00Z",
    actor: "System",
    action: "Backup abgeschlossen",
    target: "eu-central-1",
  },
  {
    id: "log_3",
    timestamp: "2026-03-11T08:05:00Z",
    actor: "Fabian Radlow",
    action: "Zugriff auf Patientenakte",
    target: "Patient #5",
  },
];

export const BACKUP_STATUS: BackupStatus[] = [
  {
    id: "backup_1",
    timestamp: "2026-03-12T04:00:00Z",
    status: "ok",
    location: "Frankfurt Cluster",
  },
  {
    id: "backup_2",
    timestamp: "2026-03-11T04:00:00Z",
    status: "ok",
    location: "Backup Vault EU",
  },
  {
    id: "backup_3",
    timestamp: "2026-03-10T04:00:00Z",
    status: "warning",
    location: "Offsite Tape",
  },
];

export const SESSION_METRICS: SessionMetric[] = [
  {
    id: "sessions_active",
    label: "Aktive Sitzungen",
    value: 42,
    change: 8,
  },
  {
    id: "sessions_new",
    label: "Neue Einladungen",
    value: 6,
    change: 12,
  },
  {
    id: "sessions_blocked",
    label: "Blockierte Logins",
    value: 3,
    change: -25,
  },
];

export const SECURITY_CONTROLS: SecurityControl[] = [
  {
    id: "mfa",
    label: "Zwei-Faktor-Pflicht",
    description: "Alle Nutzer:innen müssen sich mit App oder SMS zweiteilen.",
    enabled: true,
    impact: "hoch",
  },
  {
    id: "sso",
    label: "SSO via Azure AD",
    description: "Praxisweite Anmeldung mit bestehender Identität.",
    enabled: false,
    impact: "mittel",
  },
  {
    id: "device_trust",
    label: "Geräte-Trust",
    description: "Neue Geräte müssen durch Admin bestätigt werden.",
    enabled: true,
    impact: "mittel",
  },
  {
    id: "ip_policy",
    label: "IP-Filter",
    description: "Zugriff nur aus Kliniknetz und VPN.",
    enabled: false,
    impact: "hoch",
  },
  {
    id: "session_timeout",
    label: "Sitzungstimeout 15 min",
    description: "Automatische Sperre bei Inaktivität.",
    enabled: true,
    impact: "niedrig",
  },
];

export const ENCRYPTION_LAYERS: EncryptionLayer[] = [
  {
    id: "at_rest",
    layer: "Datenbankruhe (AES-256)",
    status: "aktiv",
    detail: "Supabase Storage & Postgres mit KMS Rotation alle 24h",
  },
  {
    id: "in_transit",
    layer: "Transport (TLS 1.3)",
    status: "aktiv",
    detail: "HSTS, Perfect Forward Secrecy, automatische Zertifikatserneuerung",
  },
  {
    id: "field_level",
    layer: "Feldverschlüsselung",
    status: "wartung",
    detail: "Sensiblen Diagnosen werden clientseitig mit Praxis-Key verschlüsselt",
  },
];

export const COMPLIANCE_CHECKLIST: ComplianceChecklistItem[] = [
  {
    id: "dpa",
    label: "AV-Vertrag & TOMs (Art. 28 DSGVO)",
    owner: "Legal",
    status: "erfüllt",
  },
  {
    id: "records",
    label: "Verzeichnis Verarbeitungstätigkeiten",
    owner: "Fabian",
    status: "in arbeit",
    dueDate: "2026-04-20",
  },
  {
    id: "dpia",
    label: "DSFA für Telemedizin",
    owner: "Sarah",
    status: "offen",
    dueDate: "2026-05-05",
  },
  {
    id: "retention",
    label: "Protokollaufbewahrung 10 Jahre",
    owner: "IT",
    status: "erfüllt",
  },
];

export const RECOVERY_OBJECTIVES: RecoveryObjective[] = [
  {
    id: "rpo",
    metric: "RPO",
    value: "5 Minuten",
    target: "≤ 15 Minuten",
    status: "grün",
  },
  {
    id: "rto",
    metric: "RTO",
    value: "18 Minuten",
    target: "≤ 30 Minuten",
    status: "grün",
  },
  {
    id: "backup_latency",
    metric: "Backup-Verfügbarkeit",
    value: "1 Minute",
    target: "≤ 5 Minuten",
    status: "gelb",
  },
];

export const INTEGRATION_TOGGLES: IntegrationToggle[] = [
  {
    id: "ehr",
    label: "EHR/FHIR Schnittstelle",
    description: "FHIR-basierter Austausch mit KIS/EPA.",
    enabled: false,
  },
  {
    id: "pharmacy",
    label: "Apothekenbestellungen",
    description: "Medikationsabgleich mit Apothekennetz.",
    enabled: true,
  },
  {
    id: "debinet",
    label: "DEBInet Import",
    description: "Original Protokolle und Rezepte übernehmen.",
    enabled: true,
  },
];

export const API_ENDPOINTS: ApiEndpointDescription[] = [
  {
    id: "endpoint_foods",
    route: "/api/v1/foods",
    method: "GET",
    description: "Listet alle Lebensmittel mit Filtern (source, category, search).",
    sampleResponse: {
      data: [
        { id: "food_karotte", name: "Karotte", source: "BLS 3.02", nutrients: { energie: 36 } },
      ],
      total: 14832,
      page: 1,
      perPage: 50,
    },
  },
  {
    id: "endpoint_food_detail",
    route: "/api/v1/foods/:id",
    method: "GET",
    description: "Gibt ein einzelnes Lebensmittel mit allen Nährstoffen zurück.",
    sampleResponse: {
      id: "food_karotte",
      name: "Karotte",
      categoryId: "cat_gemuese",
      source: "BLS 3.02",
      nutrients: [{ nutrientId: "energie", amount: 36 }],
    },
  },
  {
    id: "endpoint_recipes",
    route: "/api/v1/recipes",
    method: "GET",
    description: "Listet Rezepte mit Kategorie- und Suchfiltern.",
    sampleResponse: {
      data: [{ id: "recipe_1", name: "Kartoffelsuppe", servings: 4, category: "Suppen" }],
      total: 248,
    },
  },
  {
    id: "endpoint_patients",
    route: "/api/v1/patients",
    method: "GET",
    description: "Listet alle Patienten (authentifizierter Zugriff).",
    sampleResponse: {
      data: [{ id: "patient_1", firstName: "Maria", lastName: "Schneider", indication: "Adipositas" }],
      total: 87,
    },
  },
  {
    id: "endpoint_protocols",
    route: "/api/v1/protocols",
    method: "POST",
    description: "Empfängt und speichert digitale Ernährungsprotokolle.",
    sampleResponse: {
      status: "accepted",
      protocolId: "protocol_123",
    },
  },
  {
    id: "endpoint_export",
    route: "/api/v1/export",
    method: "POST",
    description: "Erstellt einen Export-Job für Daten (CSV, JSON, PDF).",
    sampleResponse: {
      jobId: "export_456",
      status: "in Bearbeitung",
      estimatedSeconds: 15,
    },
  },
  {
    id: "endpoint_webhooks",
    route: "/api/v1/webhooks",
    method: "PUT",
    description: "Aktualisiert eine bestehende Webhook-Konfiguration.",
    sampleResponse: {
      id: "webhook_1",
      url: "https://clinic.example.de/hooks",
      enabled: true,
    },
  },
  {
    id: "endpoint_meal_plans",
    route: "/api/v1/meal-plans",
    method: "GET",
    description: "Gibt Ernährungspläne für einen Datumsbereich zurück.",
    sampleResponse: {
      data: [{ id: "plan_1", date: "2026-03-15", slots: [] }],
      total: 30,
    },
  },
];

export const API_KEYS: ApiKey[] = [
  {
    id: "key_prod",
    label: "Produktion",
    key: "pk_live_****a8f3",
    createdAt: "2026-01-10T08:00:00Z",
    lastUsed: "2026-04-10T06:12:00Z",
    scopes: ["foods:read", "recipes:read", "patients:read", "protocols:write"],
    status: "aktiv",
  },
  {
    id: "key_dev",
    label: "Entwicklung",
    key: "pk_test_****d1b7",
    createdAt: "2026-02-05T14:30:00Z",
    lastUsed: "2026-04-09T18:45:00Z",
    scopes: ["foods:read", "recipes:read", "recipes:write"],
    status: "aktiv",
  },
  {
    id: "key_old",
    label: "Legacy-Import",
    key: "pk_live_****c902",
    createdAt: "2025-11-20T10:00:00Z",
    lastUsed: "2026-01-15T09:00:00Z",
    scopes: ["foods:read"],
    status: "widerrufen",
  },
];

export const WEBHOOK_CONFIGS: WebhookConfig[] = [
  {
    id: "webhook_patient",
    url: "https://klinik.example.de/hooks/patient",
    events: ["patient.created", "patient.updated"],
    secret: "whsec_****f2a1",
    enabled: true,
    lastTriggered: "2026-04-10T07:30:00Z",
    failCount: 0,
  },
  {
    id: "webhook_protocol",
    url: "https://praxis.example.de/api/protocol-received",
    events: ["protocol.submitted", "protocol.analyzed"],
    secret: "whsec_****b3c8",
    enabled: true,
    lastTriggered: "2026-04-09T14:10:00Z",
    failCount: 1,
  },
  {
    id: "webhook_billing",
    url: "https://billing.example.de/webhooks/prodi",
    events: ["invoice.created", "invoice.paid"],
    secret: "whsec_****e7d4",
    enabled: false,
    lastTriggered: "2026-03-28T11:00:00Z",
    failCount: 5,
  },
];

export const EXPORT_HISTORY: ExportJob[] = [
  {
    id: "job_1",
    type: "export",
    format: "CSV",
    scope: "Lebensmittel",
    status: "abgeschlossen",
    createdAt: "2026-04-10T08:15:00Z",
    fileSize: "4,2 MB",
    createdBy: "Fabian Radlow",
  },
  {
    id: "job_2",
    type: "export",
    format: "PDF",
    scope: "Patienten",
    status: "abgeschlossen",
    createdAt: "2026-04-09T16:30:00Z",
    fileSize: "1,8 MB",
    createdBy: "Sarah Dietrich",
  },
  {
    id: "job_3",
    type: "import",
    format: "JSON",
    scope: "Rezepte",
    status: "abgeschlossen",
    createdAt: "2026-04-08T10:00:00Z",
    fileSize: "856 KB",
    createdBy: "Fabian Radlow",
  },
  {
    id: "job_4",
    type: "export",
    format: "JSON",
    scope: "Ernährungspläne",
    status: "in Bearbeitung",
    createdAt: "2026-04-10T09:45:00Z",
    createdBy: "Sarah Dietrich",
  },
  {
    id: "job_5",
    type: "import",
    format: "CSV",
    scope: "Lebensmittel",
    status: "fehlgeschlagen",
    createdAt: "2026-04-07T13:20:00Z",
    fileSize: "12,1 MB",
    createdBy: "Fabian Radlow",
  },
  {
    id: "job_6",
    type: "export",
    format: "CSV",
    scope: "Rezepte",
    status: "abgeschlossen",
    createdAt: "2026-04-06T09:00:00Z",
    fileSize: "2,3 MB",
    createdBy: "Sarah Dietrich",
  },
  {
    id: "job_7",
    type: "export",
    format: "PDF",
    scope: "Berichte",
    status: "abgeschlossen",
    createdAt: "2026-04-05T14:30:00Z",
    fileSize: "3,7 MB",
    createdBy: "Fabian Radlow",
  },
];
