import type {
  ProductTier,
  TierComparisonRow,
  AddonPlan,
  BillingSummary,
  InvoiceRecord,
  UsageMetric,
} from "@/lib/types";

export const PRODUCT_TIERS: ProductTier[] = [
  {
    id: "free",
    name: "Free / Trial",
    description: "Alle Kernfeatures 14 Tage testen oder dauerhaft mit limitierter Datenbank nutzen.",
    priceMonthly: 0,
    priceAnnual: 0,
    cta: "Kostenlos starten",
    bestFor: "Einzelpraxen im Test",
    features: [
      "14-tägige Vollversion",
      "10 Rezepte & 5 Patienten",
      "Community-Forum",
    ],
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
    cta: "Compact wählen",
    badge: "Beliebt",
    bestFor: "Beratungen im Aufbau",
    features: [
      "50 Nährstoffe je Lebensmittel",
      "Unlimitierte Rezepte",
      "Kalender & Abrechnung light",
    ],
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
    cta: "Basis upgraden",
    bestFor: "Ambulante Praxen",
    features: [
      "Patientenmanagement",
      "Digitale Protokolle",
      "Mehrbenutzer & Rollen",
    ],
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
    cta: "Expert aktivieren",
    bestFor: "Versorgungszentren",
    features: [
      "80+ Nährstoffe",
      "Diabetes & Medikation",
      "Berichte & PROCAM",
    ],
    limits: [
      { label: "Benutzer", value: "10" },
      { label: "API-Zugriff", value: "inklusive" },
      { label: "Support", value: "SLA 4h" },
    ],
  },
  {
    id: "plus",
    name: "Plus Datenbank",
    description: "Add-on mit BLS/SFK-Datenbanken, 330 Nährstoffen und Herstellerdaten.",
    priceMonthly: 69,
    priceAnnual: 690,
    cta: "Add-on aktivieren",
    bestFor: "Forschung & Kliniken",
    features: [
      "BLS/SFK Zugriff",
      "330 Nährstoffe",
      "Herstellerprodukte",
    ],
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
    features: [
      "Menüzyklen bis 4 Wochen",
      "Produktion & Einkauf",
      "Kosten- & Compliance-Reporting",
    ],
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
  id: "current",
  cycle: "annual",
  nextInvoice: "2026-05-01",
  amount: "1.790 €",
  paymentMethod: "SEPA •••• 42",
  status: "aktiv",
};

export const INVOICE_HISTORY: InvoiceRecord[] = [
  {
    id: "inv_2404",
    date: "2026-04-01",
    tier: "Expert + Plus",
    amount: "1.790 €",
    status: "bezahlt",
  },
  {
    id: "inv_2403",
    date: "2025-04-01",
    tier: "Expert",
    amount: "1.390 €",
    status: "bezahlt",
  },
  {
    id: "inv_2402",
    date: "2024-04-01",
    tier: "Basis",
    amount: "790 €",
    status: "bezahlt",
  },
];

export const USAGE_METRICS: UsageMetric[] = [
  {
    id: "patients",
    label: "Aktive Patient:innen",
    used: 184,
    limit: 500,
    unit: "von 500",
  },
  {
    id: "recipes",
    label: "Gespeicherte Rezepte",
    used: 312,
    limit: 2000,
    unit: "von 2k",
  },
  {
    id: "users",
    label: "Teammitglieder",
    used: 8,
    limit: 10,
    unit: "von 10",
  },
];
