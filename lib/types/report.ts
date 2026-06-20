import { ID, Timestamped } from "./common"

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
