"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/access";
import { ADMIN_ROLES } from "@/lib/auth/rbac";
import { replaceFoodReferences } from "@/lib/data/database-lifecycle";
import { createClient } from "@/lib/supabase/server";

export interface FoodReplacementActionState {
  status: "idle" | "success" | "error";
  message: string | null;
}

const replacementSchema = z.object({
  sourceFoodId: z.string().uuid("Ausgangs-Lebensmittel fehlt."),
  targetFoodId: z.string().uuid("Ziel-Lebensmittel fehlt."),
  reason: z.string().trim().max(500, "Die Begruendung darf hoechstens 500 Zeichen enthalten.").optional(),
}).refine((value) => value.sourceFoodId !== value.targetFoodId, {
  path: ["targetFoodId"],
  message: "Ausgangs- und Ziel-Lebensmittel muessen unterschiedlich sein.",
});

function formatReplacementMessage(result: Awaited<ReturnType<typeof replaceFoodReferences>>) {
  const total =
    result.recipeIngredientsUpdated +
    result.mealEntriesUpdated +
    result.protocolEntriesUpdated;

  return [
    `${total} Referenzen ersetzt.`,
    `Rezepte: ${result.recipeIngredientsUpdated}`,
    `Plaene: ${result.mealEntriesUpdated}`,
    `Protokolle: ${result.protocolEntriesUpdated}`,
  ].join(" ");
}

export async function replaceFoodReferencesAction(
  _previousState: FoodReplacementActionState,
  formData: FormData,
): Promise<FoodReplacementActionState> {
  const parsed = replacementSchema.safeParse({
    sourceFoodId: formData.get("sourceFoodId"),
    targetFoodId: formData.get("targetFoodId"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Die Eingaben sind unvollstaendig.",
    };
  }

  try {
    const supabase = await createClient();
    await requireRole(ADMIN_ROLES, supabase);

    const result = await replaceFoodReferences({
      ...parsed.data,
      supabase,
    });

    revalidatePath("/datenbank");

    return {
      status: "success",
      message: formatReplacementMessage(result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Ersetzung ist fehlgeschlagen.";

    if (message === "AUTH_REQUIRED") {
      return {
        status: "error",
        message: "Bitte melden Sie sich an, um Lebensmittelreferenzen zu ersetzen.",
      };
    }

    if (message === "FORBIDDEN") {
      return {
        status: "error",
        message: "Nur Owner und Administratoren koennen globale Lebensmittelreferenzen ersetzen.",
      };
    }

    return {
      status: "error",
      message,
    };
  }
}
