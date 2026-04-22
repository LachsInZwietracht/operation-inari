import type { ID } from "./common";

export interface InstitutionalMenuPlan {
  id: ID;
  title: string;
  dietLineId: ID;
  cycle: "week" | "four-week";
  days: Array<{
    date: string;
    slots: Array<{
      label: string;
      recipeName: string;
      dietNotes?: string;
    }>;
  }>;
}

export interface ProductionTaskGroup {
  id: ID;
  station: string;
  day: string;
  tasks: Array<{
    item: string;
    quantity: number;
    unit: string;
  }>;
}

export interface HospitalOrderBoardEntry {
  id: ID;
  room: string;
  patient: string;
  dietLine: string;
  tags: string[];
  status: "offen" | "in arbeit" | "ausgeliefert";
}

export interface PracticeAppointment {
  id: ID;
  legacyId?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  patientId?: ID;
  location?: string;
  type: "beratung" | "kontrolle" | "team" | "webinar";
  recurring?: string;
  reminder?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceEntry {
  id: ID;
  legacyId?: string;
  patientId: ID;
  appointmentId?: string;
  service: string;
  amount: number;
  status: "offen" | "bezahlt" | "mahnung";
  dueDate: string;
  insurance?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: ID;
  name: string;
  email: string;
  role: string;
  status: "aktiv" | "gesperrt" | "eingeladen";
  lastLogin: string;
}

export type AccessLevel = "vollzugriff" | "bearbeiten" | "einsicht" | "gesperrt";

export interface RoleDefinition {
  id: ID;
  label: string;
  description: string;
  permissions: Array<{
    module: string;
    access: AccessLevel;
    critical?: boolean;
  }>;
}

export interface AuditLogEntry {
  id: ID;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
}

export interface BackupStatus {
  id: ID;
  timestamp: string;
  status: "ok" | "warning" | "error";
  location: string;
}

export interface SecurityControl {
  id: ID;
  label: string;
  description: string;
  enabled: boolean;
  impact: "hoch" | "mittel" | "niedrig";
}

export interface EncryptionLayer {
  id: ID;
  layer: string;
  status: "aktiv" | "wartung" | "risiko";
  detail: string;
}

export interface ComplianceChecklistItem {
  id: ID;
  label: string;
  owner: string;
  status: "erfüllt" | "offen" | "in arbeit";
  dueDate?: string;
}

export interface SessionMetric {
  id: ID;
  label: string;
  value: number;
  unit?: string;
  change: number;
}

export interface RecoveryObjective {
  id: ID;
  metric: string;
  value: string;
  target: string;
  status: "grün" | "gelb" | "rot";
}

export interface ProductTier {
  id: ID;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  cta: string;
  badge?: string;
  bestFor: string;
  features: string[];
  limits: Array<{
    label: string;
    value: string;
  }>;
}

export interface TierComparisonRow {
  id: ID;
  label: string;
  tiers: Record<string, "voll" | "teil" | "-">;
  helper?: string;
}

export interface AddonPlan {
  id: ID;
  name: string;
  description: string;
  price: string;
  includedIn?: string[];
}

export interface BillingSummary {
  id: ID;
  cycle: "monthly" | "annual";
  nextInvoice: string;
  amount: string;
  paymentMethod: string;
  status: "aktiv" | "überfällig" | "pausiert";
}

export interface InvoiceRecord {
  id: ID;
  date: string;
  tier: string;
  amount: string;
  status: "bezahlt" | "offen" | "fehlgeschlagen";
}

export interface UsageMetric {
  id: ID;
  label: string;
  used: number;
  limit: number;
  unit: string;
}

export interface IntegrationToggle {
  id: ID;
  label: string;
  description: string;
  enabled: boolean;
}

export interface ApiEndpointDescription {
  id: ID;
  route: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  sampleResponse: Record<string, unknown>;
}

export interface KnowledgeCard {
  id: ID;
  category: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface SustainabilityMetric {
  id: ID;
  label: string;
  value: number;
  unit: string;
  change: number;
}

// --- API & Export types ---

export interface ApiKey {
  id: ID;
  label: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  scopes: string[];
  status: "aktiv" | "widerrufen";
}

export interface WebhookConfig {
  id: ID;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  lastTriggered?: string;
  failCount: number;
}

export interface ExportJob {
  id: ID;
  type: "export" | "import";
  format: "CSV" | "JSON" | "PDF";
  scope: string;
  status: "abgeschlossen" | "in Bearbeitung" | "fehlgeschlagen";
  createdAt: string;
  fileSize?: string;
  createdBy: string;
}

export type ExportFormat = "CSV" | "JSON" | "PDF";

export type ExportScope =
  | "Lebensmittel"
  | "Rezepte"
  | "Patienten"
  | "Ernährungspläne"
  | "Berichte";

export interface ExportJobRecord extends ExportJob {
  userId?: ID;
  fileName?: string;
  parameters?: Record<string, unknown>;
}

export interface ReportExportSectionState {
  summary: boolean;
  table: boolean;
  charts: boolean;
  meals: boolean;
  notes: boolean;
}

export interface ReportExportMetric {
  label: string;
  value: string;
  reference?: string;
  coverage?: string;
}

export interface ReportExportMealRow {
  slot: string;
  summary: string;
}

export interface ReportExportRequest {
  format: "CSV" | "PDF";
  title: string;
  fileBaseName: string;
  disposition?: "attachment" | "inline";
  reportId?: ID;
  reportVersionId?: ID;
  patientId?: ID;
  patientName?: string;
  patientIndication?: string;
  planId?: ID;
  protocolId?: ID;
  planDateLabel: string;
  reportLength: "short" | "full";
  selectedSections: ReportExportSectionState;
  activeSectionLabels: string[];
  summaryMetrics: ReportExportMetric[];
  nutrientRows: ReportExportMetric[];
  vitaminRows: ReportExportMetric[];
  mineralRows: ReportExportMetric[];
  mealRows: ReportExportMealRow[];
  notes: string;
  narrative?: string;
  badges?: string[];
  specialNotes?: string[];
}

export interface PatientMailMergeDocumentRequest {
  patientId: ID;
  patientName: string;
  subject: string;
  body: string;
}

export interface PatientMailMergeExportRequest {
  format: "PDF";
  title: string;
  fileBaseName: string;
  documents: PatientMailMergeDocumentRequest[];
}

export interface GenericExportRequest {
  format: ExportFormat;
  scope: ExportScope;
}

// --- Performance types ---

export interface PerformanceMetric {
  id: ID;
  label: string;
  value: number;
  unit: string;
  target: number;
  status: "gut" | "warnung" | "kritisch";
  trend: "up" | "down" | "flat";
}

export interface LoadTestResult {
  id: ID;
  testName: string;
  concurrentUsers: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  errorRate: number;
  throughputRps: number;
  timestamp: string;
}

export interface DatabaseQueryStat {
  id: ID;
  queryName: string;
  tableName: string;
  avgDurationMs: number;
  callsPerMinute: number;
  cacheHitRate: number;
  lastExecuted: string;
}

export interface SystemResource {
  id: ID;
  label: string;
  currentValue: number;
  maxValue: number;
  unit: string;
}
