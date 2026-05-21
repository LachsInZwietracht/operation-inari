import { ID, Timestamped } from "./common"
import type { ReportExportSectionState } from "./platform"

export interface ReportRetentionPolicy extends Timestamped {
  id: ID
  userId: ID
  organizationId?: ID
  name: string
  retentionYears: number
  autoDeleteEnabled: boolean
  requireAdminApproval: boolean
  legalHoldEnabled: boolean
  notes?: string
}

export type ReportRetentionStatus = "active" | "legal_hold" | "deletion_review" | "expired"

export interface ReportTemplate extends Timestamped {
  id: ID
  name: string
  category: string
  content: string
}

export interface PatientReportSnapshot {
  format: "CSV" | "PDF"
  title: string
  fileBaseName: string
  reportId?: ID
  patientId?: ID
  patientName?: string
  patientIndication?: string
  planId?: ID
  protocolId?: ID
  planDateLabel: string
  reportLength: "short" | "full"
  selectedSections: ReportExportSectionState
  activeSectionLabels: string[]
  summaryMetrics: Array<{
    label: string
    value: string
    reference?: string
    coverage?: string
  }>
  nutrientRows: Array<{
    label: string
    value: string
    reference?: string
    coverage?: string
  }>
  vitaminRows: Array<{
    label: string
    value: string
    reference?: string
    coverage?: string
  }>
  mineralRows: Array<{
    label: string
    value: string
    reference?: string
    coverage?: string
  }>
  mealRows: Array<{
    slot: string
    summary: string
  }>
  notes: string
  narrative?: string
  badges?: string[]
  specialNotes?: string[]
  lmivRows?: Array<{
    label: string
    value: string
    reference?: string
    coverage?: string
  }>
  allergenDeclaration?: string[]
  additiveDeclaration?: string[]
  retentionPolicyLabel?: string
  documentPackLabel?: string
}

export interface PatientReportVersion extends Timestamped {
  id: ID
  patientReportId: ID
  patientRef: ID
  patientName: string
  patientIndication?: string
  planId: ID
  protocolId?: ID
  versionNumber: number
  format: "CSV" | "PDF"
  fileName: string
  fileSize: number
  contentType: string
  storageBucket: string
  storagePath: string
  snapshot: PatientReportSnapshot
  exportedAt: string
  userId?: ID
  retentionPolicyId?: ID
  retentionUntil?: string
  retentionStatus?: ReportRetentionStatus
  retentionNotes?: string
}

export interface PatientReportRecord extends Timestamped {
  id: ID
  patientRef: ID
  patientName: string
  patientIndication?: string
  planId: ID
  protocolId?: ID
  planDateLabel: string
  notes?: string
  lastFormat: "CSV" | "PDF"
  lastFileName?: string
  latestVersionId?: ID
  latestVersionNumber?: number
  versions?: PatientReportVersion[]
  userId?: ID
  retentionPolicyId?: ID
  retentionUntil?: string
  retentionStatus?: ReportRetentionStatus
  retentionNotes?: string
}
