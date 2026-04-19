import type { SupabaseClient } from "@supabase/supabase-js";

import type { InstitutionMenu, MenuCycleLength } from "@/lib/types/institution";
import type { MealSlotType } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

interface FetchMenuPlansOptions {
  supabase?: SupabaseClient;
}

interface PersistMenuPlanOptions {
  supabase?: SupabaseClient;
}

function resolveBrowserClient(supabase?: SupabaseClient) {
  if (supabase) return supabase;
  return createBrowserSupabaseClient();
}

async function getAuthenticatedUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

export async function fetchMenuPlansClient(
  options: FetchMenuPlansOptions = {},
): Promise<InstitutionMenu[]> {
  const client = resolveBrowserClient(options.supabase);
  
  const { data, error } = await withTimeout(
    client
      .from("institution_menus")
      .select("id, name, cycle_length, start_date, diet_form_ids, status, created_at, updated_at, institution_menu_slots(week_number, day_of_week, diet_form_id, slot_type, recipe_id, portion_count)")
      .order("created_at", { ascending: false }),
    5000,
    "Supabase menu plan request timed out",
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
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

    // Initialize empty weeks
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
}

export async function deleteMenuPlanClient(
  menuId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveBrowserClient(supabase);
  const { error } = await client
    .from("institution_menus")
    .delete()
    .eq("id", menuId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function persistMenuPlan(
  menu: InstitutionMenu,
  options: PersistMenuPlanOptions = {},
): Promise<void> {
  const client = resolveBrowserClient(options.supabase);
  const userId = await getAuthenticatedUserId(client);

  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  // 1. Upsert menu record
  const menuPayload = {
    id: menu.id, // Should be UUID
    name: menu.name,
    cycle_length: menu.cycleLength,
    start_date: menu.startDate,
    diet_form_ids: menu.dietFormIds,
    status: menu.status,
    user_id: userId,
  };

  const { error: menuError } = await client
    .from("institution_menus")
    .upsert(menuPayload)
    .single();

  if (menuError) {
    throw new Error(menuError.message);
  }

  // 2. Delete existing slots
  const { error: deleteError } = await client
    .from("institution_menu_slots")
    .delete()
    .eq("menu_id", menu.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  // 3. Prepare flat slots array
  const flatSlots: Record<string, unknown>[] = [];
  for (const week of menu.weeks) {
    for (const day of week.days) {
      for (const dietMenu of day.dietMenus) {
        for (const slot of dietMenu.slots) {
          flatSlots.push({
            menu_id: menu.id,
            week_number: week.weekNumber,
            day_of_week: day.dayOfWeek,
            diet_form_id: dietMenu.dietFormId,
            slot_type: slot.type,
            recipe_id: slot.recipeId,
            portion_count: slot.portionCount,
          });
        }
      }
    }
  }

  // 4. Insert new slots
  if (flatSlots.length > 0) {
    const { error: insertError } = await client
      .from("institution_menu_slots")
      .insert(flatSlots);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}
