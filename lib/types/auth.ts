export type UserRole = "ernaehrungsberater" | "admin" | "assistent";

export type AppRole = "owner" | "admin" | "dietitian" | "assistant" | "institution_admin";

export type MembershipStatus = "active" | "invited" | "disabled";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface Organization {
  id: string;
  name: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  displayName?: string;
  role: AppRole;
  status: MembershipStatus;
  invitedBy?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessAuditLogEntry {
  id: string;
  organizationId?: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
