"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { canAccessDataSource } from "@/lib/data/entitlements";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { FoodSourceId } from "@/lib/types";

export interface DataSourceActivationResult {
  status: "success" | "error";
  message: string | null;
  isActive?: boolean;
}

const activationSchema = z.object({
  sourceId: z.string().trim().min(1, "Quelle fehlt."),
  isActive: z.boolean(),
});

const offBarcodeSchema = z.string().trim().regex(/^\d{8,14}$/, "Barcode ist ungueltig.");

/**
 * Switches a connected food database on or off for the current user's
 * organization. Owner/admin only. The setting is persisted in
 * `organization_data_source_settings` and gates the database in food search.
 */
export async function setDataSourceActiveAction(
  input: { sourceId: string; isActive: boolean },
): Promise<DataSourceActivationResult> {
  const parsed = activationSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const { sourceId, isActive } = parsed.data;

  // A tariff-locked source cannot be activated; it must be unlocked first.
  if (isActive && !canAccessDataSource(sourceId as FoodSourceId)) {
    return {
      status: "error",
      message: "Diese Quelle ist nicht im Tarif freigeschaltet und kann nicht aktiviert werden.",
    };
  }

  try {
    const supabase = await createClient();
    const membership = await requireRole(ADMIN_ROLES, supabase);

    const { error } = await supabase
      .from("organization_data_source_settings")
      .upsert(
        {
          organization_id: membership.organizationId,
          source_id: sourceId,
          is_active: isActive,
          updated_by: membership.userId,
        },
        { onConflict: "organization_id,source_id" },
      );

    if (error) throw new Error(error.message);

    revalidatePath("/datenbank");
    revalidatePath("/lebensmittel");

    return {
      status: "success",
      message: isActive ? "Datenbank aktiviert." : "Datenbank deaktiviert.",
      isActive,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Aenderung ist fehlgeschlagen.";

    if (message === "AUTH_REQUIRED") {
      return { status: "error", message: "Bitte melden Sie sich an." };
    }
    if (message === "FORBIDDEN") {
      return { status: "error", message: "Nur Owner und Administratoren koennen Datenbanken aktivieren oder deaktivieren." };
    }

    return { status: "error", message };
  }
}

export async function removeOpenFoodFactsFoodAction(formData: FormData) {
  const parsed = offBarcodeSchema.safeParse(formData.get("barcode"));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Barcode ist ungueltig.");
  }

  const barcode = parsed.data;
  const supabase = await createClient();
  await requireRole(ADMIN_ROLES, supabase);

  const serviceClient = await createServiceClient();
  const { data: stagingRow, error: readError } = await serviceClient
    .from("off_staging")
    .select("validation_errors")
    .eq("barcode", barcode)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const existingErrors = Array.isArray(stagingRow?.validation_errors)
    ? stagingRow.validation_errors
    : [];
  const validationErrors = Array.from(new Set([...existingErrors, "Manually removed from food database"]));

  const { error: deleteError } = await serviceClient
    .from("foods")
    .delete()
    .eq("data_source_id", "off")
    .eq("source_food_id", barcode);

  if (deleteError) throw new Error(deleteError.message);

  const { error: stagingError } = await serviceClient
    .from("off_staging")
    .update({
      promoted: false,
      validated: false,
      validation_errors: validationErrors,
    })
    .eq("barcode", barcode);

  if (stagingError) throw new Error(stagingError.message);

  revalidatePath("/datenbank/open-food-facts");
  revalidatePath("/datenbank");
  revalidatePath("/lebensmittel");
}
