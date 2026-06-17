import { LebensmittelPageClient } from "./lebensmittel-client";
import { fetchOrganizationDisabledSourceIds } from "@/lib/data/data-source-activations";
import { fetchFoodsBrowserPage } from "@/lib/data/foods";

export const dynamic = "force-dynamic";

export default async function LebensmittelPage() {
  const [initialResult, disabledSourceIds] = await Promise.all([
    fetchFoodsBrowserPage({ mode: "name", page: 1, pageSize: 25 }),
    fetchOrganizationDisabledSourceIds(),
  ]);

  return <LebensmittelPageClient initialResult={initialResult} disabledSourceIds={disabledSourceIds} />;
}
