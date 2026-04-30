import type {
  AddonPlan,
  BillingSummary,
  InvoiceRecord,
  ProductTier,
  TierComparisonRow,
  UsageMetric,
} from "@/lib/types";

export const PRODUCT_TIERS: ProductTier[] = [
  {
    id: "free",
    name: "Free / Trial",
    description: "Alle Kernfeatures 14 Tage testen oder dauerhaft mit limitierter Datenbank nutzen.",
    priceMonthly: 0,
    priceAnnual: 0,
    cta: "Anfrage vorbereiten",
    bestFor: "Einzelpraxen im Test",
    features: ["14-tägige Vollversion", "10 Rezepte & 5 Patienten", "Community-Forum"],
    limits: [
      { label: "Rezepte", value: "10" },
      { label: "Patienten", value: "5" },
      { label: "Lebensmittel-Datenbank", value: "Basis" },
    ],
  },
  {
    id: "compact",
    name: "Compact",
    description: "Basisfunktionen plus strukturierte Patienten- und Rezeptverwaltung.",
    priceMonthly: 39,
    priceAnnual: 390,
    cta: "Anfrage vorbereiten",
    badge: "Beliebt",
    bestFor: "Beratungen im Aufbau",
    features: ["50 Nährstoffe je Lebensmittel", "Unlimitierte Rezepte", "Kalender & Abrechnung light"],
    limits: [
      { label: "Nährstoffe", value: "50" },
      { label: "Benutzer", value: "1" },
      { label: "Speicher", value: "25 GB" },
    ],
  },
  {
    id: "basis",
    name: "Basis",
    description: "Professioneller Tarif mit Patientenakten, Protokollen und Teamzugriff.",
    priceMonthly: 79,
    priceAnnual: 790,
    cta: "Anfrage vorbereiten",
    bestFor: "Ambulante Praxen",
    features: ["Patientenmanagement", "Digitale Protokolle", "Mehrbenutzer & Rollen"],
    limits: [
      { label: "Benutzer", value: "3" },
      { label: "Patienten", value: "Unlimitiert" },
      { label: "Support", value: "Priorisiert" },
    ],
  },
  {
    id: "expert",
    name: "Expert",
    description: "Komplettlösung mit Diabetes, Laboren, Statistik und Reporting.",
    priceMonthly: 139,
    priceAnnual: 1390,
    cta: "Anfrage vorbereiten",
    bestFor: "Versorgungszentren",
    features: ["80+ Nährstoffe", "Diabetes & Medikation", "Berichte & PROCAM"],
    limits: [
      { label: "Benutzer", value: "10" },
      { label: "API-Zugriff", value: "geplant" },
      { label: "Support", value: "SLA 4h" },
    ],
  },
  {
    id: "plus",
    name: "Plus Datenbank",
    description: "Add-on mit BLS/SFK-Datenbanken, 330 Nährstoffen und Herstellerdaten.",
    priceMonthly: 69,
    priceAnnual: 690,
    cta: "Anfrage vorbereiten",
    bestFor: "Forschung & Kliniken",
    features: ["BLS/SFK Zugriff", "330 Nährstoffe", "Herstellerprodukte"],
    limits: [
      { label: "Datenbanken", value: "4" },
      { label: "Herstellerprodukte", value: "29k" },
      { label: "Aktualisierung", value: "monatlich" },
    ],
  },
  {
    id: "institution",
    name: "Institution / Menü",
    description: "Mehrlinien-Pläne, Küchenprozesse und Einkauf für Kliniken.",
    priceMonthly: 249,
    priceAnnual: 2490,
    cta: "Demo anfragen",
    bestFor: "Kliniken & Caterer",
    features: ["Menüzyklen bis 4 Wochen", "Produktion & Einkauf", "Kosten- & Compliance-Reporting"],
    limits: [
      { label: "Standorte", value: "5" },
      { label: "Diet lines", value: "unlimitiert" },
      { label: "Betriebsplätze", value: "500+" },
    ],
  },
];

export const TIER_COMPARISON: TierComparisonRow[] = [
  {
    id: "foods",
    label: "Lebensmittel & Rezepte",
    tiers: {
      free: "teil",
      compact: "voll",
      basis: "voll",
      expert: "voll",
      plus: "voll",
      institution: "voll",
    },
    helper: "Basis umfasst Community-Rezepte, Expert/Plus komplette Datenbanken",
  },
  {
    id: "patients",
    label: "Patientenverwaltung",
    tiers: {
      free: "-",
      compact: "teil",
      basis: "voll",
      expert: "voll",
      plus: "voll",
      institution: "voll",
    },
  },
  {
    id: "protocols",
    label: "Digitale Protokolle",
    tiers: {
      free: "-",
      compact: "teil",
      basis: "voll",
      expert: "voll",
      plus: "voll",
      institution: "voll",
    },
  },
  {
    id: "billing",
    label: "Abrechnung & Termine",
    tiers: {
      free: "-",
      compact: "teil",
      basis: "voll",
      expert: "voll",
      plus: "voll",
      institution: "voll",
    },
  },
  {
    id: "institutional",
    label: "Menüplanung & Küche",
    tiers: {
      free: "-",
      compact: "-",
      basis: "-",
      expert: "teil",
      plus: "teil",
      institution: "voll",
    },
  },
  {
    id: "api",
    label: "API & Integrationen",
    tiers: {
      free: "-",
      compact: "-",
      basis: "teil",
      expert: "voll",
      plus: "voll",
      institution: "voll",
    },
  },
];

export const ADDON_PLANS: AddonPlan[] = [
  {
    id: "support",
    name: "Premium Support",
    description: "24/7 Hotline, dedizierte Success-Manager:in, individuelle Schulungen.",
    price: "+29 € / Monat",
    includedIn: ["institution"],
  },
  {
    id: "branding",
    name: "White-Label App",
    description: "Eigene Branding-Assets für Patientenportal & Reports.",
    price: "59 € / Monat",
  },
  {
    id: "compliance",
    name: "Compliance Paket",
    description: "DSGVO-Dokumentation, AV-Verträge und jährliches PenTest-Zertifikat.",
    price: "990 € / Jahr",
    includedIn: ["expert", "institution"],
  },
];

export const BILLING_SUMMARY: BillingSummary = {
  id: "preview",
  cycle: "annual",
  nextInvoice: "nicht verbunden",
  amount: "kein Live-Betrag",
  paymentMethod: "kein Zahlungsanbieter",
  status: "pausiert",
};

export const INVOICE_HISTORY: InvoiceRecord[] = [
  {
    id: "preview-contract",
    date: "Beispiel",
    tier: "Clinic Contract",
    amount: "nach Angebot",
    status: "offen",
  },
];

export const USAGE_METRICS: UsageMetric[] = [
  {
    id: "patients",
    label: "Aktive Patienten",
    used: 0,
    limit: 500,
    unit: "Preview",
  },
  {
    id: "recipes",
    label: "Gespeicherte Rezepte",
    used: 0,
    limit: 2000,
    unit: "Preview",
  },
  {
    id: "users",
    label: "Teammitglieder",
    used: 0,
    limit: 10,
    unit: "Preview",
  },
];

export const PROCUREMENT_SECURITY_ITEMS = [
  {
    id: "data-processing",
    title: "AVV / DSGVO-Basis",
    status: "Dokumentierbar",
    detail: "Rollen, Zweckbindung, TOM-Liste und Auftragsverarbeitung als Beschaffungspaket vorbereiten.",
  },
  {
    id: "access-control",
    title: "Zugriffsschutz",
    status: "Teilweise umgesetzt",
    detail: "Supabase Auth, RBAC-Mitgliedschaften und route-level Schutz sind vorhanden; Audit-Logs werden weiter ausgebaut.",
  },
  {
    id: "export-retention",
    title: "Berichte & Aufbewahrung",
    status: "In Umsetzung",
    detail: "Patientengebundene Berichtsversionen werden archiviert; Retention-Adminsteuerung ist als nächster Backend-Schritt geplant.",
  },
  {
    id: "deployment",
    title: "Deployment-Annahmen",
    status: "Zu prüfen",
    detail: "Mandant, Region, Supportkontakt, SSO/AD-Anbindung und Datenimport werden vor Klinikvertrag festgelegt.",
  },
];

export const MIGRATION_ONBOARDING_STEPS = [
  "PRODI-/EBIS-Exportquellen identifizieren: Rezepte, Patienten, Protokolle, Speisepläne.",
  "CSV-/Excel-Spalten mit Inari-Zielfeldern mappen und Pflichtfelder markieren.",
  "Testimport in Demo-Workspace durchführen und Nährstoffsummen stichprobenartig validieren.",
  "Altdaten nach Klinikfreigabe produktiv importieren und Importjournal sichern.",
];

export const DEMO_WORKSPACE_SETUP = [
  "Klinikdemo mit klar gekennzeichneten Beispieldaten anlegen.",
  "BLS/SFK-Quelle, Beispielpatienten, Menüzyklus, Küchencharge und Berichtshistorie vorbefüllen.",
  "Demo-Nutzerrollen für Ernährungsberatung, Küche, Stationskoordination und Admin trennen.",
  "Reset-Prozess dokumentieren, damit Sales-Demos reproduzierbar bleiben.",
];

export const CLINIC_BUYER_CHECKLIST = [
  "Datenquellen und Lizenzen",
  "Audit-Logs für Patientenzugriffe und Exporte",
  "SSO/OIDC oder SAML-Anforderungen",
  "Exportformate und Archivfristen",
  "Supportkontakte und SLA",
  "Hostingregion und Deployment-Annahmen",
  "Migrationsumfang aus PRODI/EBIS",
];
