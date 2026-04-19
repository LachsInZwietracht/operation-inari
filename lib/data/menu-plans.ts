import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { InstitutionMenu, MenuCycleLength } from "@/lib/types/institution";
import type { MealSlotType } from "@/lib/types";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";
import { INSTITUTION_MENUS } from "@/lib/mock-data";

interface FetchMenuPlansOptions {
  supabase?: SupabaseClient;
  userId?: string | null;
  limit?: number;
}

async function resolveClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createServerSupabaseClient();
}

export const fetchMenuPlans = cache(async (
  options: FetchMenuPlansOptions = {}
): Promise<InstitutionMenu[]> => {
  try {
    const client = await resolveClient(options.supabase);
    let query = client
      .from("institution_menus")
      .select("id, name, cycle_length, start_date, diet_form_ids, status, created_at, updated_at, institution_menu_slots(week_number, day_of_week, diet_form_id, slot_type, recipe_id, portion_count)")
      .order("created_at", { ascending: false });

    if (options.userId) {
      query = query.or(`user_id.eq.${options.userId},user_id.is.null`);
    } else {
      query = query.is("user_id", null);
    }

    if (typeof options.limit === "number") {
      query = query.limit(options.limit);
    }

    const { data, error } = await withTimeout(
      query,
      5000,
      "Supabase menu plan request timed out",
    );

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    if (rows.length === 0 && !options.userId) return INSTITUTION_MENUS;

    return rows.map((row: Record<string, unknown>) => {
      // Reconstruct the deep nested structure
      const menu: InstitutionMenu = {
        id: row.id as string,
        name: row.name as string,
        cycleLength: row.cycle_length as MenuCycleLength,
        startDate: row.start_date as string,
        dietFormIds: (row.diet_form_ids as string[]) || [],
        status: row.status as "draft" | "active" | "archived",
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        weeks: [],
      };

      for (let w = 1; w <= menu.cycleLength; w++) {
        menu.weeks.push({ weekNumber: w, days: [] });
      }

      const slots = (row.institution_menu_slots as Record<string, unknown>[]) || [];
      for (const slot of slots) {
        const weekNumber = slot.week_number as number;
        const week = menu.weeks.find((w) => w.weekNumber === weekNumber);
        if (!week) continue;

        const dayOfWeek = slot.day_of_week as number;
        let day = week.days.find((d) => d.dayOfWeek === dayOfWeek);
        if (!day) {
          day = { dayOfWeek: dayOfWeek, dietMenus: [] };
          week.days.push(day);
        }

        const dietFormId = slot.diet_form_id as string;
        let dietMenu = day.dietMenus.find((dm) => dm.dietFormId === dietFormId);
        if (!dietMenu) {
          dietMenu = { dietFormId: dietFormId, slots: [] };
          day.dietMenus.push(dietMenu);
        }

        dietMenu.slots.push({
          type: slot.slot_type as MealSlotType,
          recipeId: slot.recipe_id as string,
          portionCount: slot.portion_count as number,
        });
      }

      return menu;
    });
  } catch (error) {
    console.warn("Failed to fetch menu plans from Supabase:", error);
    if (!options.userId) return INSTITUTION_MENUS;
    return [];
  }
});
