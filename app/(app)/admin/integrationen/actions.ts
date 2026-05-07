"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { requireRole } from "@/lib/auth/access";
import {
  disableHl7LabMappingForAdmin,
  upsertHl7LabMappingForAdmin,
  type Hl7LabMappingStatus,
} from "@/lib/data/hl7-admin";
import { createClient } from "@/lib/supabase/server";

const HL7_MAPPING_STATUSES = ["active", "disabled"] as const satisfies readonly Hl7LabMappingStatus[];

function integrationsRedirect(status: "success" | "error", message: string): never {
  redirect(`/admin/integrationen?${status}=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseMappingStatus(value: string): Hl7LabMappingStatus | null {
  return HL7_MAPPING_STATUSES.includes(value as Hl7LabMappingStatus) ? value as Hl7LabMappingStatus : null;
}

function translateHl7MappingError(message: string) {
  if (message === "HL7_LAB_MAPPING_SOURCE_REQUIRED") return "Bitte ein Quellsystem angeben.";
  if (message === "HL7_LAB_MAPPING_IDENTIFIER_REQUIRED") return "Bitte eine HL7 Observation-ID angeben.";
  if (message === "HL7_LAB_MAPPING_PARAMETER_REQUIRED") return "Bitte eine interne Parameter-ID angeben.";
  if (message === "HL7_LAB_MAPPING_STATUS_INVALID") return "Bitte einen gueltigen Mapping-Status waehlen.";
  if (message === "HL7_LAB_MAPPING_NOT_FOUND") return "Das HL7-Labormapping wurde nicht gefunden.";
  if (message.includes("hl7_lab_parameter_mappings_organization_id_source_system_hl7")) {
    return "Diese HL7 Observation-ID ist fuer das Quellsystem bereits gemappt.";
  }
  return message;
}

export async function upsertHl7LabMappingAction(formData: FormData) {
  const supabase = await createClient();
  await requireRole(ADMIN_ROLES, supabase);

  const status = parseMappingStatus(getString(formData, "status"));
  if (!status) integrationsRedirect("error", "Bitte einen gueltigen Mapping-Status waehlen.");

  try {
    await upsertHl7LabMappingForAdmin(
      {
        id: getString(formData, "mappingId") || undefined,
        sourceSystem: getString(formData, "sourceSystem"),
        hl7Identifier: getString(formData, "hl7Identifier"),
        hl7Text: getString(formData, "hl7Text"),
        hl7CodingSystem: getString(formData, "hl7CodingSystem"),
        parameterId: getString(formData, "parameterId"),
        unit: getString(formData, "unit"),
        status,
      },
      supabase,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    integrationsRedirect("error", translateHl7MappingError(message));
  }

  revalidatePath("/admin/integrationen");
  integrationsRedirect("success", "HL7-Labormapping wurde gespeichert.");
}

export async function disableHl7LabMappingAction(formData: FormData) {
  const supabase = await createClient();
  await requireRole(ADMIN_ROLES, supabase);
  const mappingId = getString(formData, "mappingId");
  if (!mappingId) integrationsRedirect("error", "HL7-Labormapping wurde nicht angegeben.");

  try {
    await disableHl7LabMappingForAdmin(mappingId, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    integrationsRedirect("error", translateHl7MappingError(message));
  }

  revalidatePath("/admin/integrationen");
  integrationsRedirect("success", "HL7-Labormapping wurde deaktiviert.");
}
