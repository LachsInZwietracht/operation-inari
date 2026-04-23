export const VALIDATION_WORKFLOWS = [
  {
    id: "typecheck",
    label: "TypeScript Integritaet",
    command: "npm run typecheck",
    description: "Prueft App Router, Hooks, Exportvertraege und gemeinsame Typen ohne Dateimutation.",
  },
  {
    id: "playwright",
    label: "Playwright UI Smoke",
    command: "npx playwright test tests/api-export.spec.ts tests/performance.spec.ts",
    description: "Deckt die bereinigten Ops-Oberflaechen und ihre Nutzerwege im Browser ab.",
  },
  {
    id: "nutrients",
    label: "Naehrstoffvalidierung",
    command: "npm run validate:nutrients",
    description: "Vergleicht die Kernberechnungen gegen die BLS-/DGE-Mathematik.",
  },
] as const;

export const REFERENCE_BENCHMARKS = [
  {
    id: "initial-load",
    label: "Beispiel LCP Dashboard",
    value: "< 2,5 s",
    helper: "Referenzziel fuer den investor-demo-tauglichen Erstaufruf.",
  },
  {
    id: "foods-browser",
    label: "Foods Browser Antwort",
    value: "< 300 ms",
    helper: "Serverseitige Paginations-/Suchantwort unter normaler Last.",
  },
  {
    id: "report-export",
    label: "Berichtsexport Fertigstellung",
    value: "< 5 s",
    helper: "PDF/CSV fuer typische Patientenplaene ohne Queue.",
  },
  {
    id: "error-budget",
    label: "Fehlerbudget",
    value: "< 1 %",
    helper: "Akzeptierte Fehlerrate fuer Browser-Smoke- und Exportpfade.",
  },
] as const;

export const HOTSPOT_NOTES = [
  {
    id: "foods",
    title: "Lebensmittel-Suche und Browser",
    detail: "Relevant fuer RPC-/Indexpfade, OFF-Produkte und paginierte Tabellen.",
  },
  {
    id: "reports",
    title: "Export- und Berichtspipeline",
    detail: "Kritischer Pfad fuer PDF/CSV Rendering, Storage und Export-Journal.",
  },
  {
    id: "recipes",
    title: "Rezept- und Planaggregation",
    detail: "Cache-nahe Berechnungen und Nährstoffaggregation im Fokus behalten.",
  },
] as const;

export const MANUAL_VERIFICATION_CHECKS = [
  {
    id: "api-export",
    route: "/api-export",
    focus: "Export erzeugen, Verlauf filtern, Preview-Bereiche korrekt gekennzeichnet.",
  },
  {
    id: "datenbank",
    route: "/datenbank",
    focus: "Data-source Katalog aus Supabase laden und Importstatus plausibel anzeigen.",
  },
  {
    id: "wissen",
    route: "/wissen",
    focus: "Bundled Wissenskarten von live berechneten Analysekarten trennen.",
  },
] as const;
