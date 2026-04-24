import type { AppRole, UserRole } from "@/lib/types";

export const ADMIN_ROLES = ["owner", "admin"] as const satisfies readonly AppRole[];
export const INSTITUTION_ROLES = ["owner", "admin", "institution_admin"] as const satisfies readonly AppRole[];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Administrator/in",
  dietitian: "Ernaehrungsfachkraft",
  assistant: "Assistenz",
  institution_admin: "Institution Admin",
};

export function mapLegacyUserRole(role: unknown): AppRole {
  if (role === "admin") return "admin";
  if (role === "assistent") return "assistant";
  if (role === "institution_admin") return "institution_admin";
  return "dietitian";
}

export function mapAppRoleToLegacyRole(role: AppRole): UserRole {
  if (role === "admin" || role === "owner" || role === "institution_admin") return "admin";
  if (role === "assistant") return "assistent";
  return "ernaehrungsberater";
}

export function hasAnyRole(role: AppRole | null | undefined, allowedRoles: readonly AppRole[]) {
  return Boolean(role && allowedRoles.includes(role));
}
