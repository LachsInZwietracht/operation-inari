import { NextResponse } from "next/server"
import { z } from "zod"

import { requireRole } from "@/lib/auth/access"
import { fetchFoodsByIds } from "@/lib/data/foods"
import { fetchRecipes } from "@/lib/data/recipes"
import { writeAccessAuditLog } from "@/lib/audit/access-audit"
import { mealPlanExchangeSchema } from "@/lib/meal-plan-exchange"
import { createClient } from "@/lib/supabase/server"

const requestSchema = z.object({
  operation: z.enum(["import", "export"]),
  payload: z.unknown(),
})

/**
 * Confirms both permission and referenced catalogue records before a plan is
 * imported. The endpoint only validates; the client still needs an explicit
 * "Als Entwurf einsetzen" action before it writes a plan.
 */
export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null)
  const parsedRequest = requestSchema.safeParse(requestBody)
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Ungültige Plan-Datei" }, { status: 400 })
  }

  const parsedExchange = mealPlanExchangeSchema.safeParse(parsedRequest.data.payload)
  if (!parsedExchange.success) {
    return NextResponse.json(
      { error: "Die Plan-Datei hat kein unterstütztes Inari-Format." },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  try {
    const membership = await requireRole(["owner", "admin", "dietitian"], supabase)

    const foodIds = new Set<string>()
    const recipeIds = new Set<string>()
    for (const slot of parsedExchange.data.plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") foodIds.add(entry.referenceId)
        else recipeIds.add(entry.referenceId)
      }
    }

    const [foods, recipes] = await Promise.all([
      fetchFoodsByIds(Array.from(foodIds), supabase, {
        nutrientIds: [],
        includePortions: false,
      }),
      fetchRecipes({ supabase }),
    ])
    const knownFoodIds = new Set(foods.flatMap((food) => [food.id, food.legacyId].filter(Boolean)))
    const knownRecipeIds = new Set(recipes.flatMap((recipe) => [recipe.id, recipe.legacyId].filter(Boolean)))
    const unknownReferences = [
      ...Array.from(foodIds).filter((id) => !knownFoodIds.has(id)),
      ...Array.from(recipeIds).filter((id) => !knownRecipeIds.has(id)),
    ]

    if (unknownReferences.length > 0) {
      return NextResponse.json(
        {
          error: `${unknownReferences.length} Lebensmittel oder Rezept(e) sind in diesem Katalog nicht vorhanden.`,
        },
        { status: 422 },
      )
    }

    await writeAccessAuditLog(supabase, {
      action:
        parsedRequest.data.operation === "export"
          ? "meal_plan_exchange_exported"
          : "meal_plan_exchange_import_validated",
      targetType: "meal_plan",
      metadata: {
        role: membership.role,
        entries: Array.from(foodIds).length + Array.from(recipeIds).length,
      },
    })

    return NextResponse.json({ plan: parsedExchange.data.plan })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan-Datei konnte nicht geprüft werden"
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
