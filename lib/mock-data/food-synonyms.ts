import type { FoodSynonym } from "@/lib/types"

const ts = {
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
}

export const FOOD_SYNONYMS: FoodSynonym[] = [
  {
    id: "syn_pasta",
    foodId: "food_nudeln",
    name: "Pasta",
    locale: "de-DE",
    createdBy: "Ernährungsteam",
    source: "system",
    usageCount: 214,
    isPrimary: true,
    ...ts,
  },
  {
    id: "syn_haehnchenfilet",
    foodId: "food_haehnchenbrust",
    name: "Hähnchenfilet",
    locale: "de-DE",
    createdBy: "System",
    source: "system",
    usageCount: 162,
    ...ts,
  },
  {
    id: "syn_broccoli",
    foodId: "food_brokkoli",
    name: "Broccoli",
    locale: "en-US",
    createdBy: "International",
    source: "system",
    usageCount: 98,
    ...ts,
  },
  {
    id: "syn_courgette",
    foodId: "food_zucchini",
    name: "Courgette",
    locale: "en-GB",
    createdBy: "International",
    source: "system",
    usageCount: 75,
    ...ts,
  },
  {
    id: "syn_salmon",
    foodId: "food_lachs",
    name: "Salmon",
    locale: "en-US",
    createdBy: "International",
    source: "system",
    usageCount: 54,
    ...ts,
  },
]
